-- ISOLATED TEST PROJECT ONLY. Additive to team-sync-isolated.sql; never auto-run.
-- Requires SET paramount.isolated_sync_test='yes'; in the same session.
begin;
do $$ begin
  if current_setting('paramount.isolated_sync_test',true) is distinct from 'yes'
    or to_regclass('paramount_sync.documents') is null then
    raise exception 'Existing isolated sync schema and explicit acknowledgement required';
  end if;
end $$;
alter table paramount_sync.staff add column access_role text not null default 'editor'
  check(access_role in ('viewer','editor','approver','admin'));

create function paramount_sync.require_role(w uuid, roles text[]) returns void
language plpgsql security definer set search_path='' as $$ begin
  perform paramount_sync.require_staff(w);
  if not exists(select 1 from paramount_sync.staff where workspace_id=w and user_id=auth.uid()
    and active and access_role=any(roles)) then
    raise insufficient_privilege using message='Workspace role does not permit this action';
  end if;
end $$;

-- Keep the existing CAS, validation, durable-operation and history implementation.
alter function public.paramount_sync_write(uuid,uuid,text,uuid,jsonb,bigint,uuid)
  rename to paramount_sync_write_internal;
revoke all on function public.paramount_sync_write_internal(uuid,uuid,text,uuid,jsonb,bigint,uuid) from public,anon,authenticated;
create function public.paramount_sync_write(p_workspace uuid,p_id uuid,p_kind text,p_property uuid,p_payload jsonb,p_expected bigint,p_operation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
  perform 1 from paramount_sync.workspaces where id=p_workspace for update;
  perform paramount_sync.require_role(p_workspace,array['editor','approver','admin']);
  return public.paramount_sync_write_internal(p_workspace,p_id,p_kind,p_property,p_payload,p_expected,p_operation);
end $$;

create table paramount_sync.issues(
  workspace_id uuid not null, id uuid not null default gen_random_uuid(), document_id uuid not null,
  sequence bigint not null, source_version bigint not null, snapshot jsonb not null,
  digest text not null check(length(digest)=64), approved_by uuid not null references auth.users,
  approved_at timestamptz not null default clock_timestamp(), review_note text not null,
  supersedes uuid, primary key(workspace_id,id), unique(workspace_id,document_id,sequence),
  foreign key(workspace_id,document_id) references paramount_sync.documents(workspace_id,id),
  foreign key(workspace_id,supersedes) references paramount_sync.issues(workspace_id,id)
);
create table paramount_sync.signature_requests(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, issue_id uuid not null,
  token_hash bytea not null unique, recipient text not null, consent text not null,
  created_by uuid not null references auth.users, created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null, revoked_at timestamptz, signed_at timestamptz,
  signer_name text, acknowledgement text,
  foreign key(workspace_id,issue_id) references paramount_sync.issues(workspace_id,id),
  check((signed_at is null and signer_name is null and acknowledgement is null)
    or (signed_at is not null and signer_name is not null and acknowledgement is not null))
);
create table paramount_sync.issue_events(
  event_id bigint generated always as identity primary key,
  workspace_id uuid not null, issue_id uuid not null, request_id uuid references paramount_sync.signature_requests,
  event text not null check(event in ('issued','invited','revoked','signed')), actor uuid,
  occurred_at timestamptz not null default clock_timestamp(), evidence jsonb not null,
  foreign key(workspace_id,issue_id) references paramount_sync.issues(workspace_id,id)
);
alter table paramount_sync.issues enable row level security;
alter table paramount_sync.issues force row level security;
alter table paramount_sync.signature_requests enable row level security;
alter table paramount_sync.signature_requests force row level security;
alter table paramount_sync.issue_events enable row level security;
alter table paramount_sync.issue_events force row level security;
revoke all on all tables in schema paramount_sync from public,anon,authenticated;

create function public.paramount_issue(p_workspace uuid,p_document uuid,p_expected bigint,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d paramount_sync.documents; prior paramount_sync.issues; result paramount_sync.issues; frozen jsonb;
begin
  perform 1 from paramount_sync.workspaces where id=p_workspace for update;
  perform paramount_sync.require_role(p_workspace,array['approver','admin']);
  if p_note is null or length(trim(p_note)) not between 10 and 2000 then
    raise check_violation using message='Record competent approval scope and limitations (10–2000 characters)';
  end if;
  select * into d from paramount_sync.documents where workspace_id=p_workspace and id=p_document;
  if d.id is null or d.kind not in ('service','pat','lighting') or d.version is distinct from p_expected then
    raise sqlstate 'PT409' using message='Review the current synchronised engineering record before issue';
  end if;
  perform paramount_sync.validate_payload(d.kind,d.id,d.property_id,d.payload);
  select * into prior from paramount_sync.issues where workspace_id=p_workspace and document_id=p_document order by sequence desc limit 1;
  if prior.id is not null and prior.source_version=d.version then
    raise check_violation using message='This version is already issued';
  end if;
  frozen:=jsonb_build_object('workspace',p_workspace,'document',d.id,'kind',d.kind,'version',d.version,'scope',trim(p_note),
    'payload',jsonb_build_object('revision',d.payload->'revision','values',d.payload->'values','siteSnapshot',d.payload->'siteSnapshot'));
  insert into paramount_sync.issues(workspace_id,document_id,sequence,source_version,snapshot,digest,approved_by,review_note,supersedes)
    values(p_workspace,d.id,coalesce(prior.sequence,0)+1,d.version,frozen,
      encode(sha256(convert_to(frozen::text,'UTF8')),'hex'),auth.uid(),trim(p_note),prior.id) returning * into result;
  -- A correction invalidates unused links to earlier issues; signed evidence is retained.
  with revoked as (
    update paramount_sync.signature_requests set revoked_at=clock_timestamp()
    where workspace_id=p_workspace and issue_id in (
      select id from paramount_sync.issues where workspace_id=p_workspace and document_id=p_document and id<>result.id)
      and revoked_at is null and signed_at is null returning *
  ) insert into paramount_sync.issue_events(workspace_id,issue_id,request_id,event,actor,evidence)
    select workspace_id,issue_id,id,'revoked',auth.uid(),jsonb_build_object('reason','Superseded issue') from revoked;
  insert into paramount_sync.issue_events(workspace_id,issue_id,event,actor,evidence)
    values(p_workspace,result.id,'issued',auth.uid(),jsonb_build_object('digest',result.digest,'source_version',d.version));
  return to_jsonb(result);
end $$;

create function public.paramount_signature_invite(p_workspace uuid,p_issue uuid,p_recipient text,p_hours integer default 72) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i paramount_sync.issues; r paramount_sync.signature_requests; secret text;
begin
  perform 1 from paramount_sync.workspaces where id=p_workspace for update;
  perform paramount_sync.require_role(p_workspace,array['approver','admin']);
  select * into i from paramount_sync.issues where workspace_id=p_workspace and id=p_issue;
  if i.id is null or exists(select 1 from paramount_sync.issues where workspace_id=p_workspace and supersedes=i.id)
    or p_hours is null or p_hours not between 1 and 168 or p_recipient is null or length(trim(p_recipient)) not between 1 and 254 then
    raise check_violation using message='Current issue, recipient and expiry (1–168 hours) required';
  end if;
  secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into paramount_sync.signature_requests(workspace_id,issue_id,token_hash,recipient,consent,created_by,expires_at)
    values(p_workspace,p_issue,sha256(convert_to(secret,'UTF8')),trim(p_recipient),
      'I acknowledge receipt of this exact record and its stated scope and limitations. This acknowledgement does not certify system compliance.',
      auth.uid(),clock_timestamp()+make_interval(hours=>p_hours)) returning * into r;
  insert into paramount_sync.issue_events(workspace_id,issue_id,request_id,event,actor,evidence)
    values(p_workspace,p_issue,r.id,'invited',auth.uid(),jsonb_build_object('expires_at',r.expires_at,'digest',i.digest));
  return jsonb_build_object('request',r.id,'token',secret,'expires_at',r.expires_at,'digest',i.digest);
end $$;

create function public.paramount_signature_revoke(p_workspace uuid,p_request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r paramount_sync.signature_requests;
begin
  perform 1 from paramount_sync.workspaces where id=p_workspace for update;
  perform paramount_sync.require_role(p_workspace,array['approver','admin']);
  update paramount_sync.signature_requests set revoked_at=clock_timestamp() where workspace_id=p_workspace
    and id=p_request and signed_at is null and revoked_at is null returning * into r;
  if r.id is null then raise check_violation using message='No unsigned active request';end if;
  insert into paramount_sync.issue_events(workspace_id,issue_id,request_id,event,actor,evidence)
    values(p_workspace,r.issue_id,r.id,'revoked',auth.uid(),'{}');
end $$;

-- Bearer capability: no customer account, no list/search API, no token in audit or stored plaintext.
-- Endpoint must be rate limited by the hosting gateway before hosted acceptance.
create function public.paramount_signature_read(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r paramount_sync.signature_requests; i paramount_sync.issues;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise insufficient_privilege using message='Link unavailable';end if;
  select * into r from paramount_sync.signature_requests where token_hash=sha256(convert_to(p_token,'UTF8'));
  if r.id is null or r.revoked_at is not null or r.expires_at<=clock_timestamp() then
    raise insufficient_privilege using message='Link unavailable';
  end if;
  select * into i from paramount_sync.issues where workspace_id=r.workspace_id and id=r.issue_id;
  -- Expose the current revision only, never the record history, staff IDs or invitation recipient.
  return jsonb_build_object('issue',i.id,'sequence',i.sequence,'digest',i.digest,'kind',i.snapshot->>'kind',
    'values',i.snapshot->'payload'->'values','site',i.snapshot->'payload'->'siteSnapshot',
    'approved_at',i.approved_at,'scope',i.review_note,'canonical_document',i.snapshot::text,'consent',r.consent,
    'expires_at',r.expires_at,'signed_at',r.signed_at,'signer_name',r.signer_name);
end $$;

create function public.paramount_signature_accept(p_token text,p_digest text,p_name text,p_consent text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r paramount_sync.signature_requests; i paramount_sync.issues; w uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise insufficient_privilege using message='Link unavailable';end if;
  select workspace_id into w from paramount_sync.signature_requests where token_hash=sha256(convert_to(p_token,'UTF8'));
  -- Same lock order as issue/revoke/write: concurrent signing cannot bypass revocation.
  perform 1 from paramount_sync.workspaces where id=w for update;
  perform public.paramount_signature_read(p_token);
  select * into r from paramount_sync.signature_requests where token_hash=sha256(convert_to(p_token,'UTF8')) for update;
  select * into i from paramount_sync.issues where workspace_id=w and id=r.issue_id;
  if r.signed_at is not null or p_digest is distinct from i.digest or p_consent is distinct from r.consent
    or p_name is null or length(trim(p_name)) not between 2 and 150 then
    raise check_violation using message='Unsigned link, matching document and explicit acknowledgement required';
  end if;
  update paramount_sync.signature_requests set signed_at=clock_timestamp(),signer_name=trim(p_name),acknowledgement=p_consent where id=r.id;
  insert into paramount_sync.issue_events(workspace_id,issue_id,request_id,event,evidence)
    values(w,i.id,r.id,'signed',jsonb_build_object('digest',i.digest,'consent',p_consent,'name',trim(p_name),
      'identity_assurance','Possession of invitation link; name self-declared'));
  return public.paramount_signature_read(p_token);
end $$;

create function public.paramount_issue_history(p_workspace uuid,p_document uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
  perform paramount_sync.require_staff(p_workspace);
  return jsonb_build_object('issues',coalesce((select jsonb_agg(to_jsonb(i) order by sequence) from paramount_sync.issues i
    where workspace_id=p_workspace and document_id=p_document),'[]'),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by event_id) from paramount_sync.issue_events e
    where workspace_id=p_workspace and issue_id in(select id from paramount_sync.issues where workspace_id=p_workspace and document_id=p_document)),'[]'));
end $$;

revoke all on all functions in schema paramount_sync from public,anon,authenticated;
revoke all on function public.paramount_issue(uuid,uuid,bigint,text),public.paramount_signature_invite(uuid,uuid,text,integer),
  public.paramount_signature_revoke(uuid,uuid),public.paramount_signature_read(text),
  public.paramount_signature_accept(text,text,text,text),public.paramount_issue_history(uuid,uuid),
  public.paramount_sync_write(uuid,uuid,text,uuid,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.paramount_issue(uuid,uuid,bigint,text),public.paramount_signature_invite(uuid,uuid,text,integer),
  public.paramount_signature_revoke(uuid,uuid),public.paramount_issue_history(uuid,uuid),
  public.paramount_sync_write(uuid,uuid,text,uuid,jsonb,bigint,uuid) to authenticated;
grant execute on function public.paramount_signature_read(text),public.paramount_signature_accept(text,text,text,text) to anon,authenticated;
commit;
