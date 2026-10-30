-- ISOLATED ONLY. Apply after shared-templates; never auto-run on production.
begin;
do $$ begin
 if current_setting('paramount.isolated_sync_test',true) is distinct from 'yes'
 or to_regclass('paramount_sync.templates') is null then
 raise exception 'Isolated template schema and acknowledgement required'; end if;
end $$;
create table paramount_sync.template_scans(
 workspace_id uuid not null references paramount_sync.workspaces,
 hash text not null check(hash ~ '^[0-9a-f]{64}$'),
 format text not null check(format in ('pdf','docx')),
 original bytea not null check(octet_length(original) between 1 and 2097152),
 state text not null default 'pending' check(state in ('pending','scanning','clean','blocked')),
 lease uuid, lease_until timestamptz, fields jsonb,
 checked_at timestamptz, scanner text,
 created_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,hash,format),check(hash=encode(sha256(original),'hex'))
);
alter table paramount_sync.template_scans enable row level security;
alter table paramount_sync.template_scans force row level security;
revoke all on paramount_sync.template_scans from public,anon,authenticated,service_role;
create function public.paramount_template_scan_request(p_workspace uuid,p_content text,p_hash text,p_format text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b bytea; s paramount_sync.template_scans; begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 perform paramount_sync.require_role(p_workspace,array['admin']);
 if p_content is null or length(p_content)>2796204 or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_format is null or p_format not in ('pdf','docx') then
 raise check_violation using message='Invalid scan request'; end if;
 b=decode(p_content,'base64');
 if octet_length(b) not between 1 and 2097152 or encode(sha256(b),'hex')<>p_hash then
 raise check_violation using message='Invalid scan bytes'; end if;
 select * into s from paramount_sync.template_scans where workspace_id=p_workspace and hash=p_hash and format=p_format;
 if not found then
 if (select count(*) from paramount_sync.template_scans where workspace_id=p_workspace)>=100
 or coalesce((select sum(octet_length(original)) from paramount_sync.template_scans where workspace_id=p_workspace),0)+octet_length(b)>20971520 then
 raise check_violation using message='Quarantine quota reached; authorised retention review required'; end if;
 insert into paramount_sync.template_scans(workspace_id,hash,format,original) values(p_workspace,p_hash,p_format,b) returning * into s;
 end if;
 return jsonb_build_object('state',s.state,'hash',s.hash);
end $$;
create function public.paramount_template_scan_claim() returns jsonb
language plpgsql security definer set search_path='' as $$ declare s paramount_sync.template_scans; begin
 select * into s from paramount_sync.template_scans where state='pending' or state='scanning' and lease_until<clock_timestamp()
 order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update paramount_sync.template_scans set state='scanning',lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes'
 where workspace_id=s.workspace_id and hash=s.hash and format=s.format returning * into s;
 return jsonb_build_object('workspace',s.workspace_id,'hash',s.hash,'format',s.format,'lease',s.lease,'content',replace(encode(s.original,'base64'),E'\n',''));
end $$;
create function public.paramount_template_scan_finish(p_workspace uuid,p_hash text,p_format text,p_lease uuid,p_clean boolean,p_fields jsonb,p_scanner text) returns boolean
language plpgsql security definer set search_path='' as $$ begin
 if p_clean is null or p_scanner is null or length(p_scanner) not between 1 and 200
 or (p_clean and (jsonb_typeof(p_fields) is distinct from 'array' or jsonb_array_length(p_fields)>200
 or exists(select 1 from jsonb_array_elements(p_fields) x where jsonb_typeof(x) is distinct from 'string'))) then
 raise check_violation using message='Invalid trusted scan result'; end if;
 update paramount_sync.template_scans set state=case when p_clean then 'clean' else 'blocked' end,
 fields=case when p_clean then p_fields else null end,checked_at=clock_timestamp(),scanner=p_scanner,lease=null,lease_until=null
 where workspace_id=p_workspace and hash=p_hash and format=p_format and state='scanning' and lease=p_lease and lease_until>clock_timestamp();
 return found;
end $$;
create function paramount_sync.enforce_template_scan() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from paramount_sync.template_scans s where s.workspace_id=new.workspace_id and s.hash=new.hash
 and s.format=new.payload->>'format' and s.original=new.original and s.state='clean' and s.fields=new.payload->'fields') then
 raise check_violation using message='Trusted clean scan of exact original and fields required'; end if;
 return new;
end $$;
-- Guards every publication path, including the existing admin RPC and activation.
create trigger template_scan_gate before insert or update on paramount_sync.templates
for each row when (new.active) execute function paramount_sync.enforce_template_scan();
-- Wrap the existing RPC too: idempotent returns must not bypass quarantine.
alter function public.paramount_template_publish(uuid,uuid,uuid,bigint,uuid,text,jsonb,text,text) set schema paramount_sync;
revoke all on function paramount_sync.paramount_template_publish(uuid,uuid,uuid,bigint,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
create function public.paramount_template_publish(p_workspace uuid,p_id uuid,p_family uuid,p_expected bigint,p_property uuid,p_company text,p_payload jsonb,p_content text,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 perform paramount_sync.require_role(p_workspace,array['admin']);
 if not exists(select 1 from paramount_sync.template_scans where workspace_id=p_workspace and hash=p_hash
 and format=p_payload->>'format' and original=decode(p_content,'base64') and state='clean' and fields=p_payload->'fields') then
 raise check_violation using message='Trusted clean scan required before publication'; end if;
 return paramount_sync.paramount_template_publish(p_workspace,p_id,p_family,p_expected,p_property,p_company,p_payload,p_content,p_hash);
end $$;
revoke all on function public.paramount_template_publish(uuid,uuid,uuid,bigint,uuid,text,jsonb,text,text) from public,anon,service_role;
grant execute on function public.paramount_template_publish(uuid,uuid,uuid,bigint,uuid,text,jsonb,text,text) to authenticated;
-- Pre-existing unscanned versions are quarantined from normal retrieval too.
create function paramount_sync.template_scan_clean(w uuid,h text,f text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from paramount_sync.template_scans where workspace_id=w and hash=h and format=f and state='clean');
$$;
-- Replace read functions without weakening staff/property checks.
create or replace function public.paramount_template_list(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 perform paramount_sync.require_staff(p_workspace);
 return coalesce((select jsonb_agg(paramount_sync.template_json(t,false) order by created_at,id) from paramount_sync.templates t
 where workspace_id=p_workspace and paramount_sync.template_visible(p_workspace,property_id)
 and paramount_sync.template_scan_clean(workspace_id,hash,payload->>'format')),'[]'::jsonb);
end $$;
create or replace function public.paramount_template_get(p_workspace uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare t paramount_sync.templates; begin
 perform paramount_sync.require_staff(p_workspace);
 select * into t from paramount_sync.templates where workspace_id=p_workspace and id=p_id;
 if not found or not paramount_sync.template_visible(p_workspace,t.property_id)
 or not paramount_sync.template_scan_clean(p_workspace,t.hash,t.payload->>'format') then
 raise insufficient_privilege using message='Template unavailable'; end if;
 return paramount_sync.template_json(t,true);
end $$;
revoke all on function paramount_sync.enforce_template_scan(),paramount_sync.template_scan_clean(uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.paramount_template_scan_request(uuid,text,text,text),public.paramount_template_scan_claim(),public.paramount_template_scan_finish(uuid,text,text,uuid,boolean,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.paramount_template_scan_request(uuid,text,text,text) to authenticated;
grant execute on function public.paramount_template_scan_claim(),public.paramount_template_scan_finish(uuid,text,text,uuid,boolean,jsonb,text) to service_role;
commit;
