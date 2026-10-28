-- Additive isolated-only migration. Apply after controlled-issue-isolated.sql.
begin;
do $$begin
 if current_setting('paramount.isolated_sync_test',true) is distinct from 'yes' or to_regclass('paramount_sync.issues') is null then raise exception 'Explicit isolated acknowledgement and controlled issue schema required';end if;
end$$;
alter table paramount_sync.documents drop constraint documents_kind_check;
alter table paramount_sync.documents add constraint documents_kind_check check(kind in ('property','service','pat','lighting','extinguisher','installation','quote','invoice','visit','callout','enquiry','drawing','equipment'));
alter table paramount_sync.documents add column restricted boolean not null default false;
create table paramount_sync.record_access(
 workspace_id uuid not null,document_id uuid not null,user_id uuid not null,
 permission text not null check(permission in ('read','edit','issue')),
 primary key(workspace_id,document_id,user_id),
 foreign key(workspace_id,document_id) references paramount_sync.documents(workspace_id,id),
 foreign key(workspace_id,user_id) references paramount_sync.staff(workspace_id,user_id)
);
create table paramount_sync.access_events(
 id bigint generated always as identity primary key,workspace_id uuid not null,document_id uuid not null,
 actor uuid not null,occurred_at timestamptz not null default clock_timestamp(),evidence jsonb not null
);
alter table paramount_sync.record_access enable row level security;
alter table paramount_sync.record_access force row level security;
alter table paramount_sync.access_events enable row level security;
alter table paramount_sync.access_events force row level security;
revoke all on all tables in schema paramount_sync from public,anon,authenticated;
create function paramount_sync.can_access(w uuid,d uuid,action text) returns boolean
language plpgsql security definer set search_path='' as $$
declare role_name text; current_doc paramount_sync.documents; parent paramount_sync.documents; perm text;
begin
 select access_role into role_name from paramount_sync.staff where workspace_id=w and user_id=auth.uid() and active;
 if role_name is null or action not in ('read','edit','issue') then return false;end if;
 if action='edit' and role_name='viewer' or action='issue' and role_name not in ('approver','admin') then return false;end if;
 -- Workspace administrators are accountable recovery authorities; every ACL change is audited.
 if role_name='admin' then return true;end if;
 select * into current_doc from paramount_sync.documents where workspace_id=w and id=d;
 for parent in select * from paramount_sync.documents where workspace_id=w and (id=d or id=current_doc.property_id) loop
  if parent.restricted then
   select permission into perm from paramount_sync.record_access where workspace_id=w and document_id=parent.id and user_id=auth.uid();
   if perm is null or action='edit' and perm='read' or action='issue' and perm<>'issue' then return false;end if;
  end if;
 end loop;
 return true;
end$$;
create function paramount_sync.require_access(w uuid,d uuid,action text) returns void
language plpgsql security definer set search_path='' as $$begin
 if not paramount_sync.can_access(w,d,action) then raise insufficient_privilege using message='Record access unavailable';end if;
end$$;
create function public.paramount_record_access(p_workspace uuid,p_document uuid,p_restricted boolean,p_grants jsonb) returns void
language plpgsql security definer set search_path='' as $$declare g jsonb;begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 perform paramount_sync.require_role(p_workspace,array['admin']);
 if p_restricted is null or jsonb_typeof(p_grants) is distinct from 'array' or jsonb_array_length(p_grants)>100 or not exists(select 1 from paramount_sync.documents where workspace_id=p_workspace and id=p_document) then raise check_violation using message='Invalid access policy';end if;
 delete from paramount_sync.record_access where workspace_id=p_workspace and document_id=p_document;
 for g in select value from jsonb_array_elements(p_grants) loop
  insert into paramount_sync.record_access values(p_workspace,p_document,(g->>'user')::uuid,g->>'permission');
 end loop;
 update paramount_sync.documents set restricted=p_restricted where workspace_id=p_workspace and id=p_document;
 insert into paramount_sync.access_events(workspace_id,document_id,actor,evidence) values(p_workspace,p_document,auth.uid(),jsonb_build_object('restricted',p_restricted,'grants',p_grants));
end$$;
-- Preserve all original engineering validation and revision/CAS rules.
alter function paramount_sync.validate_payload(text,uuid,uuid,jsonb) rename to validate_engineering;
create function paramount_sync.validate_payload(k text,ident uuid,prop uuid,p jsonb) returns void
language plpgsql set search_path='' as $$declare h jsonb;v jsonb;f text;required text[];line text;parts text[];subtotal numeric;begin
 if k in ('property','service','pat','lighting') then perform paramount_sync.validate_engineering(k,ident,prop,p);return;end if;
 if k not in ('extinguisher','installation','quote','invoice','visit','callout','enquiry','drawing','equipment') or p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>500000 or p->>'id' is distinct from ident::text or p->>'kind' is distinct from k or prop is null or jsonb_typeof(p->'history') is distinct from 'array' or jsonb_typeof(p->'values') is distinct from 'object' or coalesce(p->>'revision','')!~'^[1-9][0-9]*$' then raise check_violation using message='Invalid shared record';end if;
 for f in select jsonb_object_keys(p) loop
  if f not in ('id','kind','values','history','revision','created','updated','siteSnapshot') then raise check_violation using message='Unexpected shared field';end if;
 end loop;
 required:=case k
 when 'extinguisher' then array['engineer','asset','location','model','capacity','visitType','tests','outcome','defects']
 when 'installation' then array['engineer','stage','system','standard','drawingRef','devices','tests','defects','actions','recipient','declaration']
 when 'quote' then array['number','customer','address','due','lines','vat','terms']
 when 'invoice' then array['number','customer','address','due','lines','vat','terms']
 when 'visit' then array['engineer','time','minutes','serviceType','status','notes']
 when 'callout' then array['engineer','number','priority','status','issue','defects','actions']
 when 'enquiry' then array['customer','contact','site','status','owner','notes']
 when 'drawing' then array['title','layout','notes']
 else array['manufacturer','model','title','url','checked','notes'] end;
 for h in select p->'values' union all select value->'values' from jsonb_array_elements(p->'history') loop
  if jsonb_typeof(h) is distinct from 'object' or h->>'reviewed' is distinct from 'yes' or h->>'property' is distinct from prop::text or coalesce(h->>'date','')!~'^\d{4}-\d{2}-\d{2}$' then raise check_violation using message='Reviewed site-linked values required';end if;
  perform (h->>'date')::date;
  foreach f in array required loop if jsonb_typeof(h->f) is distinct from 'string' or coalesce(length(trim(h->>f)),0)=0 then raise check_violation using message='Required shared field missing';end if;end loop;
  for f,v in select key,value from jsonb_each(h) loop if jsonb_typeof(v)<>'string' or length(v::text)>100000 then raise check_violation using message='Invalid shared field value';end if;end loop;
  if k in ('quote','invoice') then
   perform (h->>'due')::date;
   if (h->>'due')::date<(h->>'date')::date or h->>'vat'!~'^\d+(\.\d{1,2})?$' or (h->>'vat')::numeric not between 0 and 100 then raise check_violation using message='Invalid commercial date or VAT';end if;
   subtotal:=0;
   for line in select regexp_split_to_table(h->>'lines',E'\n') loop
    parts:=string_to_array(line,'|');
    if cardinality(parts)<>3 or trim(parts[1])='' or trim(parts[2])!~'^\d+$' or trim(parts[3])!~'^\d+(\.\d{1,2})?$' then raise check_violation using message='Invalid commercial lines';end if;
    subtotal:=subtotal+trim(parts[2])::numeric*trim(parts[3])::numeric*100;
    if trim(parts[3])::numeric>1000000 or subtotal>10000000000 or trim(parts[2])::numeric not between 1 and 10000 then raise check_violation using message='Invalid quantity';end if;
   end loop;
  end if;
  if k='visit' and (h->>'time'!~'^([01]\d|2[0-3]):[0-5]\d$' or h->>'minutes'!~'^\d+$' or (h->>'minutes')::numeric not between 1 and 1440 or h->>'status' not in ('Planned','Confirmed','Completed','Cancelled')) then raise check_violation using message='Invalid visit';end if;
  if k='equipment' and h->>'url'!~'^https://[^ /]+' then raise check_violation using message='HTTPS manual required';end if;
 end loop;
end$$;
create or replace function public.paramount_sync_list(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$begin
 perform paramount_sync.require_staff(p_workspace);
 return coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from paramount_sync.documents d where workspace_id=p_workspace and paramount_sync.can_access(p_workspace,d.id,'read')),'[]'::jsonb);
end$$;
-- Every public entry point receives the same record/parent policy, including history and invitations.
alter function public.paramount_sync_write(uuid,uuid,text,uuid,jsonb,bigint,uuid) rename to paramount_sync_write_role_internal;
create function public.paramount_sync_write(p_workspace uuid,p_id uuid,p_kind text,p_property uuid,p_payload jsonb,p_expected bigint,p_operation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 perform paramount_sync.require_access(p_workspace,p_id,'edit');
 if p_property is not null then perform paramount_sync.require_access(p_workspace,p_property,'edit');end if;
 return public.paramount_sync_write_role_internal(p_workspace,p_id,p_kind,p_property,p_payload,p_expected,p_operation);
end$$;
alter function public.paramount_issue(uuid,uuid,bigint,text) rename to paramount_issue_internal;
create function public.paramount_issue(p_workspace uuid,p_document uuid,p_expected bigint,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 perform paramount_sync.require_access(p_workspace,p_document,'issue');
 return public.paramount_issue_internal(p_workspace,p_document,p_expected,p_note);
end$$;
alter function public.paramount_issue_history(uuid,uuid) rename to paramount_issue_history_internal;
create function public.paramount_issue_history(p_workspace uuid,p_document uuid) returns jsonb
language plpgsql security definer set search_path='' as $$begin
 perform paramount_sync.require_access(p_workspace,p_document,'read');
 return public.paramount_issue_history_internal(p_workspace,p_document);
end$$;
alter function public.paramount_signature_invite(uuid,uuid,text,integer) rename to paramount_signature_invite_internal;
create function public.paramount_signature_invite(p_workspace uuid,p_issue uuid,p_recipient text,p_hours integer default 72) returns jsonb
language plpgsql security definer set search_path='' as $$declare d uuid;begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 select document_id into d from paramount_sync.issues where workspace_id=p_workspace and id=p_issue;
 if d is null then raise insufficient_privilege;end if;
 perform paramount_sync.require_access(p_workspace,d,'issue');
 return public.paramount_signature_invite_internal(p_workspace,p_issue,p_recipient,p_hours);
end$$;
alter function public.paramount_signature_revoke(uuid,uuid) rename to paramount_signature_revoke_internal;
create function public.paramount_signature_revoke(p_workspace uuid,p_request uuid) returns void
language plpgsql security definer set search_path='' as $$declare d uuid;begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 select i.document_id into d from paramount_sync.signature_requests r join paramount_sync.issues i on i.workspace_id=r.workspace_id and i.id=r.issue_id where r.workspace_id=p_workspace and r.id=p_request;
 if d is null then raise insufficient_privilege;end if;
 perform paramount_sync.require_access(p_workspace,d,'issue');
 perform public.paramount_signature_revoke_internal(p_workspace,p_request);
end$$;
revoke all on all functions in schema paramount_sync from public,anon,authenticated;
revoke all on function public.paramount_sync_write_role_internal(uuid,uuid,text,uuid,jsonb,bigint,uuid),public.paramount_issue_internal(uuid,uuid,bigint,text),public.paramount_issue_history_internal(uuid,uuid),public.paramount_signature_invite_internal(uuid,uuid,text,integer),public.paramount_signature_revoke_internal(uuid,uuid) from public,anon,authenticated;
revoke all on function public.paramount_record_access(uuid,uuid,boolean,jsonb),public.paramount_sync_write(uuid,uuid,text,uuid,jsonb,bigint,uuid),public.paramount_issue(uuid,uuid,bigint,text),public.paramount_issue_history(uuid,uuid),public.paramount_signature_invite(uuid,uuid,text,integer),public.paramount_signature_revoke(uuid,uuid) from public,anon,authenticated;
grant execute on function public.paramount_record_access(uuid,uuid,boolean,jsonb),public.paramount_sync_write(uuid,uuid,text,uuid,jsonb,bigint,uuid),public.paramount_issue(uuid,uuid,bigint,text),public.paramount_issue_history(uuid,uuid),public.paramount_signature_invite(uuid,uuid,text,integer),public.paramount_signature_revoke(uuid,uuid) to authenticated;
create or replace function public.paramount_issue_internal(p_workspace uuid,p_document uuid,p_expected bigint,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d paramount_sync.documents; prior paramount_sync.issues; result paramount_sync.issues; frozen jsonb;
begin
  perform 1 from paramount_sync.workspaces where id=p_workspace for update;
  perform paramount_sync.require_role(p_workspace,array['approver','admin']);
  if p_note is null or length(trim(p_note)) not between 10 and 2000 then
    raise check_violation using message='Record competent approval scope and limitations (10–2000 characters)';
  end if;
  select * into d from paramount_sync.documents where workspace_id=p_workspace and id=p_document;
  if d.id is null or d.kind not in ('service','pat','lighting','quote') or d.version is distinct from p_expected then
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


commit;
