-- Isolated-only. After shared-records-isolated.sql. No hosted execution by the app.
begin;
do $$begin
 if current_setting('paramount.isolated_sync_test',true) is distinct from 'yes' or to_regclass('paramount_sync.record_access') is null then raise exception 'Explicit isolated acknowledgement and shared-record schema required';end if;
end$$;
alter table paramount_sync.signature_requests add column code_hash bytea,add column code_expires timestamptz,
 add column code_created timestamptz,add column code_attempts integer not null default 0,
 add column proof_hash bytea,add column proof_expires timestamptz,add column verified_at timestamptz;
alter table paramount_sync.issue_events drop constraint issue_events_event_check;
alter table paramount_sync.issue_events add constraint issue_events_event_check check(event in ('issued','invited','revoked','signed','verified','email_accepted','email_failed'));
create table paramount_sync.delivery_config(workspace_id uuid primary key references paramount_sync.workspaces,customer_origin text not null check(customer_origin~'^https://[a-zA-Z0-9.-]+(:[0-9]+)?$'));
create table paramount_sync.mail_outbox(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references paramount_sync.workspaces,
 dedupe text not null unique,kind text not null check(kind in ('invitation','verification','receipt','reminder')),
 request_id uuid references paramount_sync.signature_requests,document_id uuid,due date,days integer,
 recipient text not null,body jsonb not null,status text not null default 'queued' check(status in ('queued','leased','sent','cancelled','failed')),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 next_at timestamptz not null default clock_timestamp(),attempts integer not null default 0,
 lease uuid,lease_until timestamptz,first_attempt timestamptz,provider_id text,sent_at timestamptz
);
create table paramount_sync.reminder_subscriptions(
 workspace_id uuid not null,document_id uuid not null,recipient text not null,active boolean not null default true,
 created_by uuid not null,primary key(workspace_id,document_id,recipient),
 foreign key(workspace_id,document_id) references paramount_sync.documents(workspace_id,id)
);
create table paramount_sync.delivery_events(
 id bigint generated always as identity primary key,mail_id uuid not null references paramount_sync.mail_outbox,
 event text not null,occurred_at timestamptz not null default clock_timestamp(),evidence jsonb not null
);
alter table paramount_sync.delivery_config enable row level security;
alter table paramount_sync.delivery_config force row level security;
alter table paramount_sync.mail_outbox enable row level security;
alter table paramount_sync.mail_outbox force row level security;
alter table paramount_sync.reminder_subscriptions enable row level security;
alter table paramount_sync.reminder_subscriptions force row level security;
alter table paramount_sync.delivery_events enable row level security;
alter table paramount_sync.delivery_events force row level security;
revoke all on all tables in schema paramount_sync from public,anon,authenticated;
-- Only a database owner configures an approved isolated customer origin. No client redirects.
create function paramount_sync.email_valid(email text) returns boolean language sql immutable set search_path='' as $$
 select email is not null and length(email) between 3 and 254 and email~'^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$'
$$;
create or replace function public.paramount_signature_invite(p_workspace uuid,p_issue uuid,p_recipient text,p_hours integer default 72) returns jsonb
language plpgsql security definer set search_path='' as $$declare d uuid;r jsonb;origin text;email text:=lower(trim(p_recipient));begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 select document_id into d from paramount_sync.issues where workspace_id=p_workspace and id=p_issue;
 if d is null then raise insufficient_privilege;end if;
 perform paramount_sync.require_access(p_workspace,d,'issue');
 select customer_origin into origin from paramount_sync.delivery_config where workspace_id=p_workspace;
 if origin is null or not paramount_sync.email_valid(email) then raise check_violation using message='Approved customer origin and valid recipient email required';end if;
 r:=public.paramount_signature_invite_internal(p_workspace,p_issue,email,p_hours);
 insert into paramount_sync.mail_outbox(workspace_id,dedupe,kind,request_id,recipient,body,expires_at)
 values(p_workspace,'invite:'||(r->>'request'),'invitation',(r->>'request')::uuid,email,
 jsonb_build_object('subject','Paramount record acknowledgement','text','Review your record: '||origin||'/signature-test.html#token='||(r->>'token')),(r->>'expires_at')::timestamptz);
 -- Staff never receive the bearer token through the new delivery API.
 return r-'token'||jsonb_build_object('delivery','queued');
end$$;
create function public.paramount_signature_challenge(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$declare r paramount_sync.signature_requests;code text;begin
 if p_token is null or p_token!~'^[0-9a-f]{64}$' then return '{"status":"If available, a verification code is queued."}'::jsonb;end if;
 select * into r from paramount_sync.signature_requests where token_hash=sha256(convert_to(p_token,'UTF8')) for update;
 if r.id is null or r.revoked_at is not null or r.expires_at<=clock_timestamp() or not paramount_sync.email_valid(r.recipient) or r.code_created>clock_timestamp()-interval '60 seconds' or (select count(*) from paramount_sync.mail_outbox where request_id=r.id and kind='verification' and created_at>clock_timestamp()-interval '1 hour')>=5 then return '{"status":"If available, a verification code is queued."}'::jsonb;end if;
 code:=substr(replace(gen_random_uuid()::text,'-',''),1,8);
 update paramount_sync.signature_requests set code_hash=sha256(convert_to(p_token||code,'UTF8')),code_expires=clock_timestamp()+interval '10 minutes',code_created=clock_timestamp(),code_attempts=0,proof_hash=null,proof_expires=null where id=r.id;
 update paramount_sync.mail_outbox set status='cancelled',body='{}' where request_id=r.id and kind='verification' and status='queued';
 insert into paramount_sync.mail_outbox(workspace_id,dedupe,kind,request_id,recipient,body,expires_at)
 values(r.workspace_id,'verify:'||gen_random_uuid(),'verification',r.id,r.recipient,jsonb_build_object('subject','Paramount verification code','text','Your one-time verification code is '||code||'. It expires in 10 minutes. Do not share this code.'),clock_timestamp()+interval '10 minutes');
 return '{"status":"If available, a verification code is queued."}'::jsonb;
end$$;
create function public.paramount_signature_verify(p_token text,p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$declare r paramount_sync.signature_requests;proof text;begin
 if p_token is null or p_token!~'^[0-9a-f]{64}$' then return null;end if;
 select * into r from paramount_sync.signature_requests where token_hash=sha256(convert_to(p_token,'UTF8')) for update;
 if r.id is null or r.revoked_at is not null or r.expires_at<=clock_timestamp() or r.code_expires<=clock_timestamp() or r.code_hash is null or r.code_attempts>=5 then return null;end if;
 -- Failure returns rather than raises: attempt count must commit.
 update paramount_sync.signature_requests set code_attempts=code_attempts+1 where id=r.id;
 if p_code is null or p_code!~'^[0-9a-f]{8}$' or r.code_hash<>sha256(convert_to(p_token||p_code,'UTF8')) then return null;end if;
 proof:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 update paramount_sync.signature_requests set proof_hash=sha256(convert_to(proof,'UTF8')),proof_expires=least(expires_at,clock_timestamp()+interval '15 minutes'),verified_at=coalesce(verified_at,clock_timestamp()),code_hash=null where id=r.id;
 insert into paramount_sync.issue_events(workspace_id,issue_id,request_id,event,evidence) values(r.workspace_id,r.issue_id,r.id,'verified',jsonb_build_object('method','email code','recipient',r.recipient));
 return jsonb_build_object('proof',proof);
end$$;
create function paramount_sync.verified_request(token text,proof text) returns paramount_sync.signature_requests
language plpgsql security definer set search_path='' as $$declare r paramount_sync.signature_requests;begin
 if token is null or token!~'^[0-9a-f]{64}$' or proof is null or proof!~'^[0-9a-f]{64}$' then raise insufficient_privilege using message='Verification unavailable';end if;
 select * into r from paramount_sync.signature_requests where token_hash=sha256(convert_to(token,'UTF8'));
 if r.id is null or r.revoked_at is not null or r.expires_at<=clock_timestamp() or r.proof_expires<=clock_timestamp() or r.proof_hash is null or r.proof_hash<>sha256(convert_to(proof,'UTF8')) then raise insufficient_privilege using message='Verification unavailable';end if;
 return r;
end$$;
create function public.paramount_signature_read_verified(p_token text,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $$declare r paramount_sync.signature_requests;begin
 r:=paramount_sync.verified_request(p_token,p_proof);
 return public.paramount_signature_read(p_token)||jsonb_build_object('request',r.id,'verified_email',r.recipient,'verified_at',r.verified_at,'identity_assurance','Mailbox access verified by one-time email code; name and authority self-declared');
end$$;
create function public.paramount_signature_accept_verified(p_token text,p_proof text,p_digest text,p_name text,p_consent text) returns jsonb
language plpgsql security definer set search_path='' as $$declare r paramount_sync.signature_requests;i paramount_sync.issues;receipt jsonb;begin
 r:=paramount_sync.verified_request(p_token,p_proof);
 perform 1 from paramount_sync.workspaces where id=r.workspace_id for update;
 r:=paramount_sync.verified_request(p_token,p_proof);
 select * into i from paramount_sync.issues where workspace_id=r.workspace_id and id=r.issue_id;
 if p_digest is distinct from i.digest or p_consent is distinct from r.consent or p_name is null or length(trim(p_name)) not between 2 and 150 then raise check_violation using message='Exact digest, consent and signer name required';end if;
 -- Idempotent repeat of the exact acknowledgement, including a lost response.
 if r.signed_at is not null then
  if r.signer_name<>trim(p_name) or r.acknowledgement<>p_consent then raise check_violation using message='Acknowledgement already recorded';end if;
  return public.paramount_signature_read_verified(p_token,p_proof);
 end if;
 update paramount_sync.signature_requests set signed_at=clock_timestamp(),signer_name=trim(p_name),acknowledgement=p_consent where id=r.id;
 insert into paramount_sync.issue_events(workspace_id,issue_id,request_id,event,evidence) values(r.workspace_id,i.id,r.id,'signed',jsonb_build_object('digest',i.digest,'consent',p_consent,'name',trim(p_name),'verified_email',r.recipient,'verified_at',r.verified_at,'identity_assurance','Mailbox access verified by one-time email code; name and authority self-declared'));
 receipt:=public.paramount_signature_read_verified(p_token,p_proof);
 insert into paramount_sync.mail_outbox(workspace_id,dedupe,kind,request_id,recipient,body,expires_at)
 values(r.workspace_id,'receipt:'||r.id,'receipt',r.id,r.recipient,jsonb_build_object('subject','Paramount acknowledgement receipt','text','Your acknowledgement was recorded. Issue: '||i.id||E'\nDigest: '||i.digest||E'\nSigned at: '||(receipt->>'signed_at')||E'\nName: '||trim(p_name)||E'\nConsent: '||p_consent),clock_timestamp()+interval '23 hours') on conflict(dedupe) do nothing;
 return receipt;
end$$;
-- Close legacy anonymous/staff bearer-only read/accept and internal-invite bypasses.
revoke all on function public.paramount_signature_read(text),public.paramount_signature_accept(text,text,text,text) from public,anon,authenticated;
create function public.paramount_reminder_set(p_workspace uuid,p_document uuid,p_email text,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$declare email text:=lower(trim(p_email));begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 perform paramount_sync.require_access(p_workspace,p_document,'issue');
 if p_active is null or not exists(select 1 from paramount_sync.documents where workspace_id=p_workspace and id=p_document) or not paramount_sync.email_valid(email) or not exists(select 1 from paramount_sync.signature_requests where workspace_id=p_workspace and recipient=email and verified_at is not null and signed_at is not null) then raise check_violation using message='An acknowledged, mailbox-verified recipient is required';end if;
 insert into paramount_sync.reminder_subscriptions values(p_workspace,p_document,email,p_active,auth.uid()) on conflict(workspace_id,document_id,recipient) do update set active=excluded.active;
end$$;
create function paramount_sync.reminder_date(value text) returns date language plpgsql immutable set search_path='' as $$begin return nullif(value,'')::date;exception when others then return null;end$$;
create function public.paramount_mail_schedule() returns integer
language plpgsql security definer set search_path='' as $$declare count_rows integer;begin
 insert into paramount_sync.mail_outbox(workspace_id,dedupe,kind,document_id,due,days,recipient,body,expires_at)
 select s.workspace_id,'reminder:'||s.workspace_id||':'||s.document_id||':'||s.recipient||':'||due.date||':'||lead.days,'reminder',s.document_id,due.date,lead.days,s.recipient,
 jsonb_build_object('subject','Paramount scheduled service reminder','text','Record '||d.id||' has an agreed date of '||due.date||'. Please contact your Paramount team to confirm scope and arrangements.'),least(due.date::timestamptz,clock_timestamp()+interval '23 hours')
 from paramount_sync.reminder_subscriptions s join paramount_sync.documents d on d.workspace_id=s.workspace_id and d.id=s.document_id
 cross join lateral (select paramount_sync.reminder_date(case when d.kind='visit' then d.payload->'values'->>'date' else d.payload->'values'->>'next' end) as date) due
 cross join (values(30),(7)) lead(days)
 where s.active and due.date>(clock_timestamp() at time zone 'UTC')::date
 and due.date-(clock_timestamp() at time zone 'UTC')::date<=lead.days
 and (lead.days=7 or due.date-(clock_timestamp() at time zone 'UTC')::date>7)
 and coalesce(d.payload->'values'->>'status','') not in ('Completed','Cancelled','Closed','Closed after verification')
 on conflict(dedupe) do nothing;
 get diagnostics count_rows=row_count;return count_rows;
end$$;
-- Worker-only RPCs. Atomic SKIP LOCKED claim; stable provider idempotency key across crash/retry.
create function public.paramount_mail_claim() returns jsonb
language plpgsql security definer set search_path='' as $$declare m paramount_sync.mail_outbox;begin
 update paramount_sync.mail_outbox set status='failed',body='{}' where status in ('queued','leased') and (expires_at<=clock_timestamp() or attempts>=5 and coalesce(lease_until,'-infinity')<=clock_timestamp() or first_attempt<=clock_timestamp()-interval '23 hours');
 -- Invalidate changed schedules, disabled subscriptions and revoked/expired links before delivery.
 update paramount_sync.mail_outbox m set status='cancelled',body='{}' where m.status in ('queued','leased') and (
 (m.kind in ('invitation','verification') and not exists(select 1 from paramount_sync.signature_requests r where r.id=m.request_id and r.revoked_at is null and (m.kind='verification' or r.signed_at is null) and r.expires_at>clock_timestamp())) or
 (m.kind='reminder' and not exists(select 1 from paramount_sync.reminder_subscriptions s join paramount_sync.documents d on d.workspace_id=s.workspace_id and d.id=s.document_id where s.workspace_id=m.workspace_id and s.document_id=m.document_id and s.recipient=m.recipient and s.active and paramount_sync.reminder_date(case when d.kind='visit' then d.payload->'values'->>'date' else d.payload->'values'->>'next' end)=m.due and coalesce(d.payload->'values'->>'status','') not in ('Completed','Cancelled','Closed','Closed after verification'))));
 select * into m from paramount_sync.mail_outbox where (status='queued' or status='leased' and lease_until<=clock_timestamp()) and next_at<=clock_timestamp() order by created_at,id for update skip locked limit 1;
 if m.id is null then return null;end if;
 update paramount_sync.mail_outbox set status='leased',lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',attempts=attempts+1,first_attempt=coalesce(first_attempt,clock_timestamp()) where id=m.id returning * into m;
 insert into paramount_sync.delivery_events(mail_id,event,evidence) values(m.id,'claimed',jsonb_build_object('attempt',m.attempts));
 return to_jsonb(m);
end$$;
create function public.paramount_mail_finish(p_id uuid,p_lease uuid,p_outcome text,p_provider text default null) returns boolean
language plpgsql security definer set search_path='' as $$declare m paramount_sync.mail_outbox;begin
 select * into m from paramount_sync.mail_outbox where id=p_id for update;
 if m.id is null or m.status<>'leased' or m.lease is distinct from p_lease or m.lease_until<=clock_timestamp() then return false;end if;
 if p_outcome not in ('accepted','retry','permanent') or p_outcome='accepted' and (p_provider is null or length(p_provider)>200) then raise check_violation using message='Invalid delivery outcome';end if;
 update paramount_sync.mail_outbox set status=case when p_outcome='accepted' then 'sent' when p_outcome='permanent' or attempts>=5 then 'failed' else 'queued' end,
 body=case when p_outcome='accepted' or p_outcome='permanent' or attempts>=5 then '{}' else body end,
 sent_at=case when p_outcome='accepted' then clock_timestamp() end,provider_id=case when p_outcome='accepted' then p_provider end,
 next_at=clock_timestamp()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)),lease=null,lease_until=null where id=m.id;
 insert into paramount_sync.delivery_events(mail_id,event,evidence) values(m.id,p_outcome,jsonb_build_object('provider_id',case when p_outcome='accepted' then p_provider end,'attempt',m.attempts));
 if m.request_id is not null then insert into paramount_sync.issue_events(workspace_id,issue_id,request_id,event,evidence) select r.workspace_id,r.issue_id,r.id,case when p_outcome='accepted' then 'email_accepted' else 'email_failed' end,jsonb_build_object('mail',m.id,'kind',m.kind,'provider_id',case when p_outcome='accepted' then p_provider end,'outcome',p_outcome) from paramount_sync.signature_requests r where r.id=m.request_id;end if;
 return true;
end$$;
-- service_role is a server-only worker credential; it never appears in browser config.
revoke all on all functions in schema paramount_sync from public,anon,authenticated;
revoke all on function public.paramount_signature_challenge(text),public.paramount_signature_verify(text,text),public.paramount_signature_read_verified(text,text),public.paramount_signature_accept_verified(text,text,text,text,text),public.paramount_reminder_set(uuid,uuid,text,boolean),public.paramount_mail_schedule(),public.paramount_mail_claim(),public.paramount_mail_finish(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.paramount_signature_challenge(text),public.paramount_signature_verify(text,text),public.paramount_signature_read_verified(text,text),public.paramount_signature_accept_verified(text,text,text,text,text) to anon,authenticated;
grant execute on function public.paramount_reminder_set(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.paramount_mail_schedule(),public.paramount_mail_claim(),public.paramount_mail_finish(uuid,uuid,text,text) to service_role;
commit;
