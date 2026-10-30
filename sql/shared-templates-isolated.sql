-- ISOLATED TEST DATABASE ONLY. Never auto-run or apply to production.
-- Requires team-sync, controlled-issue and shared-records isolated migrations.
begin;
do $$ begin
 if current_setting('paramount.isolated_sync_test',true) is distinct from 'yes'
 or to_regprocedure('paramount_sync.can_access(uuid,uuid,text)') is null then
  raise exception 'Existing isolated permissions schema and acknowledgement required';
 end if;
end $$;
create table paramount_sync.templates(
 workspace_id uuid not null references paramount_sync.workspaces,
 id uuid not null, family uuid not null, version bigint not null check(version>0),
 property_id uuid, company text not null check(company in ('','paramount','absolute')),
 payload jsonb not null, original bytea not null check(octet_length(original) between 1 and 2097152),
 hash text not null check(hash ~ '^[0-9a-f]{64}$'), active boolean not null default true,
 created_by uuid not null references auth.users, created_at timestamptz not null default now(),
 primary key(workspace_id,id), unique(workspace_id,family,version),
 foreign key(workspace_id,property_id) references paramount_sync.documents(workspace_id,id),
 check(hash=encode(sha256(original),'hex'))
);
create table paramount_sync.template_events(
 sequence bigint generated always as identity primary key,
 workspace_id uuid not null, template_id uuid not null, actor uuid not null references auth.users,
 action text not null check(action in ('publish','deactivate','activate')), created_at timestamptz not null default now(),
 foreign key(workspace_id,template_id) references paramount_sync.templates(workspace_id,id)
);
alter table paramount_sync.templates enable row level security;
alter table paramount_sync.templates force row level security;
alter table paramount_sync.template_events enable row level security;
alter table paramount_sync.template_events force row level security;
revoke all on paramount_sync.templates,paramount_sync.template_events from public,anon,authenticated;

create function paramount_sync.template_visible(w uuid,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p is null or paramount_sync.can_access(w,p,'read');
$$;
create function paramount_sync.template_json(t paramount_sync.templates,include_bytes boolean) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',t.id,'family',t.family,'version',t.version,'property',coalesce(t.property_id::text,''),
 'company',t.company,'active',t.active,'hash',t.hash,'created',t.created_at,'createdBy',t.created_by,
 'name',t.payload->>'name','kind',t.payload->>'kind','filename',t.payload->>'filename','format',t.payload->>'format',
 'fields',t.payload->'fields','mappings',t.payload->'mappings') ||
 case when include_bytes then jsonb_build_object('content',replace(encode(t.original,'base64'),E'\n','')) else '{}'::jsonb end;
$$;
create function public.paramount_template_list(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 perform paramount_sync.require_staff(p_workspace);
 return coalesce((select jsonb_agg(paramount_sync.template_json(t,false) order by created_at,id)
 from paramount_sync.templates t where workspace_id=p_workspace
 and paramount_sync.template_visible(p_workspace,property_id)),'[]'::jsonb);
end $$;
create function public.paramount_template_get(p_workspace uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare t paramount_sync.templates; begin
 perform paramount_sync.require_staff(p_workspace);
 select * into t from paramount_sync.templates where workspace_id=p_workspace and id=p_id;
 if not found or not paramount_sync.template_visible(p_workspace,t.property_id) then
  raise insufficient_privilege using message='Template unavailable';
 end if;
 return paramount_sync.template_json(t,true);
end $$;
create function public.paramount_template_publish(p_workspace uuid,p_id uuid,p_family uuid,p_expected bigint,p_property uuid,p_company text,p_payload jsonb,p_content text,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b bytea; old paramount_sync.templates; latest bigint; m jsonb; pair record;
begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 perform paramount_sync.require_role(p_workspace,array['admin']);
 if p_id is null or p_family is null or p_expected is null or p_expected<0 or p_company is null or p_company not in ('','paramount','absolute')
 or p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>100000
 or jsonb_typeof(p_payload->'name') is distinct from 'string' or length(trim(p_payload->>'name')) not between 1 and 120
 or coalesce(p_payload->>'format','') not in ('pdf','docx')
 or coalesce(p_payload->>'kind','') not in ('service','pat','lighting','extinguisher','installation','quote','invoice','visit','callout','enquiry','drawing','equipment','')
 or jsonb_typeof(p_payload->'filename') is distinct from 'string' or length(p_payload->>'filename') not between 1 and 200
 or jsonb_typeof(p_payload->'fields') is distinct from 'array' or jsonb_array_length(p_payload->'fields')>200
 or jsonb_typeof(p_payload->'mappings') is distinct from 'array' or jsonb_array_length(p_payload->'mappings')>100
 or p_content is null or length(p_content)>2796204 or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
 raise check_violation using message='Invalid template metadata';end if;
 if p_property is not null and not exists(select 1 from paramount_sync.documents where workspace_id=p_workspace and id=p_property and kind='property') then
 raise check_violation using message='Invalid template property';end if;
 b=decode(p_content,'base64');
 if octet_length(b) not between 1 and 2097152 or encode(sha256(b),'hex')<>p_hash
 or p_payload->>'format'='pdf' and substring(b from 1 for 5)<>convert_to('%PDF-','UTF8')
 or p_payload->>'format'='docx' and substring(b from 1 for 2)<>decode('504b','hex') then
 raise check_violation using message='Original bytes/hash/format mismatch';end if;
 for m in select value from jsonb_array_elements(p_payload->'mappings') loop
  if p_payload->>'format'<>'pdf' or jsonb_typeof(m) is distinct from 'object'
  or jsonb_typeof(m->'name') is distinct from 'string' or length(trim(m->>'name')) not between 1 and 120
  or jsonb_typeof(m->'fields') is distinct from 'object' or m->'fields'='{}'::jsonb then
  raise check_violation using message='Invalid mapping';end if;
  for pair in select * from jsonb_each_text(m->'fields') loop
   if pair.value is null or not (p_payload->'fields' ? pair.key) or pair.value not in
   ('reference','revision','branding','contractor','issuer','status','visitId','date','engineer','site','address','customer','customerName','system','standard','panelSerial','zones','location','asset','appliance','model','capacity','manufactured','next','tests','defects','actions','scope','measurements','battery','batteryAh','equipmentClass','instrument','calibration','ratedDuration','duration','number','title') then
   raise check_violation using message='Unsupported mapping value';end if;
  end loop;
 end loop;
 select * into old from paramount_sync.templates where workspace_id=p_workspace and id=p_id;
 if found then
  if old.family=p_family and old.version=p_expected+1 and old.property_id is not distinct from p_property and old.company=p_company
  and old.hash=p_hash and old.original=b and old.payload=p_payload and old.created_by=auth.uid() then
  return paramount_sync.template_json(old,true);end if;
  raise serialization_failure using message='Immutable template ID conflict';
 end if;
 select coalesce(max(version),0) into latest from paramount_sync.templates where workspace_id=p_workspace and family=p_family;
 if latest<>p_expected then raise serialization_failure using message='Template family version conflict';end if;
 if (select count(*) from paramount_sync.templates where workspace_id=p_workspace)>=100
 or coalesce((select sum(octet_length(original)) from paramount_sync.templates where workspace_id=p_workspace),0)+octet_length(b)>20971520 then
 raise check_violation using message='Workspace template quota exceeded; retain backup and review storage';end if;
 -- Previous versions remain available for historical records; only availability changes.
 insert into paramount_sync.template_events(workspace_id,template_id,actor,action)
 select p_workspace,id,auth.uid(),'deactivate' from paramount_sync.templates where workspace_id=p_workspace and family=p_family and active;
 update paramount_sync.templates set active=false where workspace_id=p_workspace and family=p_family;
 insert into paramount_sync.templates(workspace_id,id,family,version,property_id,company,payload,original,hash,created_by)
 values(p_workspace,p_id,p_family,p_expected+1,p_property,p_company,p_payload,b,p_hash,auth.uid()) returning * into old;
 insert into paramount_sync.template_events(workspace_id,template_id,actor,action) values(p_workspace,p_id,auth.uid(),'publish');
 return paramount_sync.template_json(old,true);
end $$;
create function public.paramount_template_active(p_workspace uuid,p_id uuid,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$ declare t paramount_sync.templates; begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 perform paramount_sync.require_role(p_workspace,array['admin']);
 select * into t from paramount_sync.templates where workspace_id=p_workspace and id=p_id;
 if not found or p_active is null then raise check_violation using message='Template unavailable';end if;
 if p_active and exists(select 1 from paramount_sync.templates where workspace_id=p_workspace and family=t.family and version>t.version) then
 raise check_violation using message='Only the latest template version can be activated';end if;
 if t.active is distinct from p_active then
 update paramount_sync.templates set active=p_active where workspace_id=p_workspace and id=p_id;
 insert into paramount_sync.template_events(workspace_id,template_id,actor,action) values(p_workspace,p_id,auth.uid(),case when p_active then 'activate' else 'deactivate' end);
 end if;
end $$;
create function public.paramount_template_backup(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 perform 1 from paramount_sync.workspaces where id=p_workspace for update;
 perform paramount_sync.require_role(p_workspace,array['admin']);
 return jsonb_build_object('version',1,'workspace',p_workspace,'templates',coalesce((select jsonb_agg(paramount_sync.template_json(t,true) order by family,version) from paramount_sync.templates t where workspace_id=p_workspace),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(to_jsonb(e) order by sequence) from paramount_sync.template_events e where workspace_id=p_workspace),'[]'::jsonb));
end $$;
revoke all on function paramount_sync.template_visible(uuid,uuid),paramount_sync.template_json(paramount_sync.templates,boolean) from public,anon,authenticated;
revoke all on function public.paramount_template_list(uuid),public.paramount_template_get(uuid,uuid),public.paramount_template_publish(uuid,uuid,uuid,bigint,uuid,text,jsonb,text,text),public.paramount_template_active(uuid,uuid,boolean),public.paramount_template_backup(uuid) from public,anon;
grant execute on function public.paramount_template_list(uuid),public.paramount_template_get(uuid,uuid),public.paramount_template_publish(uuid,uuid,uuid,bigint,uuid,text,jsonb,text,text),public.paramount_template_active(uuid,uuid,boolean),public.paramount_template_backup(uuid) to authenticated;
commit;
