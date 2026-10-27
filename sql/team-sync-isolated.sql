-- ISOLATED TEST DATABASE ONLY. Review and execute manually; never auto-migrate.
-- Requires: SET paramount.isolated_sync_test = 'yes'; in this same session.
begin;
do $$ begin
  if current_setting('paramount.isolated_sync_test',true) is distinct from 'yes' then
    raise exception 'Isolated test database acknowledgement required';
  end if;
  if to_regnamespace('paramount_sync') is not null then
    raise exception 'Schema already exists: inspect migration state; do not overwrite';
  end if;
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null
    or not exists(select 1 from pg_roles where rolname='anon')
    or not exists(select 1 from pg_roles where rolname='authenticated') then
    raise exception 'Required Supabase auth objects/roles are missing; inspect preflight';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('paramount_sync_list','paramount_sync_write')) then
    raise exception 'Sync RPC name already exists: inspect definitions; do not overwrite';
  end if;
end $$;
create schema paramount_sync;
revoke all on schema paramount_sync from public, anon, authenticated;
create table paramount_sync.workspaces(id uuid primary key, label text not null);
create table paramount_sync.staff(
  workspace_id uuid not null references paramount_sync.workspaces,
  user_id uuid not null references auth.users,
  slot smallint not null check(slot between 1 and 3),
  active boolean not null default true,
  primary key(workspace_id,user_id), unique(workspace_id,slot)
);
create table paramount_sync.documents(
  workspace_id uuid not null references paramount_sync.workspaces,
  id uuid not null, kind text not null check(kind in ('property','service','pat','lighting')),
  property_id uuid, payload jsonb not null, version bigint not null check(version>0),
  updated_by uuid not null references auth.users, updated_at timestamptz not null default now(),
  primary key(workspace_id,id),
  foreign key(workspace_id,property_id) references paramount_sync.documents(workspace_id,id),
  check((kind='property' and property_id is null) or (kind<>'property' and property_id is not null))
);
create table paramount_sync.operations(
  workspace_id uuid not null, operation_id uuid not null, actor uuid not null,
  request jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
  primary key(workspace_id,operation_id),
  foreign key(workspace_id) references paramount_sync.workspaces
);
-- No client can mutate memberships, overwrite documents directly, or erase audit.
alter table paramount_sync.workspaces enable row level security;
alter table paramount_sync.workspaces force row level security;
alter table paramount_sync.staff enable row level security;
alter table paramount_sync.staff force row level security;
alter table paramount_sync.documents enable row level security;
alter table paramount_sync.documents force row level security;
alter table paramount_sync.operations enable row level security;
alter table paramount_sync.operations force row level security;
revoke all on all tables in schema paramount_sync from public, anon, authenticated;

create function paramount_sync.require_staff(w uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from paramount_sync.staff where workspace_id=w and user_id=auth.uid() and active) then
    raise insufficient_privilege using message='Staff access required';
  end if;
end $$;

create function paramount_sync.validate_payload(k text, ident uuid, prop uuid, p jsonb) returns void
language plpgsql set search_path='' as $$
declare f text; fields text[]; v jsonb; h jsonb;
begin
  if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>500000 or p->>'id' is distinct from ident::text then
    raise check_violation using message='Invalid payload';
  end if;
  if k='property' then
    if prop is not null or coalesce(length(trim(p->>'name')),0)=0 or coalesce(length(trim(p->>'panel')),0)=0
      or coalesce(p->>'months','') !~ '^[0-9]+$' or (p->>'months')::numeric not between 1 and 60
      or coalesce(p->>'last','') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise check_violation using message='Invalid property';
    end if;
    perform (p->>'last')::date;
    for f,v in select key,value from jsonb_each(p) loop
      if f not in ('id','name','address','postcode','panel','contact','phone','email','last','months') or jsonb_typeof(v)<>'string' or length(v::text)>100000 then
        raise check_violation using message='Unexpected property field';
      end if;
    end loop;
    return;
  end if;
  if k not in ('service','pat','lighting') or prop is null or p->>'kind' is distinct from k
    or jsonb_typeof(p->'values') is distinct from 'object' or jsonb_typeof(p->'history') is distinct from 'array'
    or coalesce(p->>'revision','') !~ '^[1-9][0-9]*$' then
    raise check_violation using message='Invalid record';
  end if;
  for f in select jsonb_object_keys(p) loop
    if f not in ('id','kind','values','history','revision','created','updated','siteSnapshot') then
      raise check_violation using message='Unexpected record field';
    end if;
  end loop;
  fields:=case k when 'service' then array['engineer','system','standard','tests','battery','measurements','defects','actions','recipient','declaration']
    when 'pat' then array['engineer','instrument','calibration','asset','appliance','location','equipmentClass','visual','tests','outcome','defects']
    else array['engineer','system','location','testType','tests','defects','actions'] end;
  -- Validate both the current values and every preserved revision.
  for h in select p->'values' union all select value->'values' from jsonb_array_elements(p->'history') loop
    if jsonb_typeof(h) is distinct from 'object' or h->>'reviewed' is distinct from 'yes' or h->>'property' is distinct from prop::text
      or coalesce(h->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise check_violation using message='Invalid reviewed values';
    end if;
    perform (h->>'date')::date;
    foreach f in array fields loop
      if jsonb_typeof(h->f) is distinct from 'string' or length(trim(h->>f))=0 then
        raise check_violation using message='Required result missing';
      end if;
    end loop;
    for f,v in select key,value from jsonb_each(h) loop
      if jsonb_typeof(v)<>'string' or length(v::text)>100000 then raise check_violation using message='Invalid field';end if;
    end loop;
    if k='lighting' and h->>'testType'='Duration test' and
      (coalesce(h->>'duration','') !~ '^[0-9]+(\.[0-9]{1,2})?$' or (h->>'duration')::numeric not between 0.01 and 1440) then
      raise check_violation using message='Actual duration required';
    end if;
  end loop;
end $$;

create function public.paramount_sync_list(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform paramount_sync.require_staff(p_workspace);
  return coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from paramount_sync.documents d where workspace_id=p_workspace),'[]'::jsonb);
end $$;

create function public.paramount_sync_write(p_workspace uuid,p_id uuid,p_kind text,p_property uuid,p_payload jsonb,p_expected bigint,p_operation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old paramount_sync.documents; op paramount_sync.operations; req jsonb; result jsonb; prior jsonb;
begin
  -- One workspace lock serialises CAS, idempotency, parent checks and revocation.
  perform 1 from paramount_sync.workspaces where id=p_workspace for update;
  perform paramount_sync.require_staff(p_workspace);
  if p_operation is null or p_id is null or p_expected is null or p_expected<0 then raise check_violation using message='Invalid request';end if;
  req:=jsonb_build_object('id',p_id,'kind',p_kind,'property',p_property,'payload',p_payload,'expected',p_expected);
  select * into op from paramount_sync.operations where workspace_id=p_workspace and operation_id=p_operation;
  if found then
    if op.actor<>auth.uid() or op.request<>req then raise check_violation using message='Operation reference reused';end if;
    return op.result;
  end if;
  perform paramount_sync.validate_payload(p_kind,p_id,p_property,p_payload);
  select * into old from paramount_sync.documents where workspace_id=p_workspace and id=p_id;
  if coalesce(old.version,0)<>p_expected then raise sqlstate 'PT409' using message='Version conflict';end if;
  if old.id is not null and (old.kind<>p_kind or old.property_id is distinct from p_property) then
    raise check_violation using message='Record identity and site link are immutable';
  end if;
  if p_kind<>'property' then
    if not exists(select 1 from paramount_sync.documents where workspace_id=p_workspace and id=p_property and kind='property') then
      raise check_violation using message='Sync the property first';
    end if;
    if old.id is not null then
      prior:=jsonb_build_object('revision',old.payload->'revision','values',old.payload->'values','updated',old.payload->'updated');
      if old.payload ? 'siteSnapshot' then prior:=prior||jsonb_build_object('siteSnapshot',old.payload->'siteSnapshot');end if;
      if (p_payload->>'revision')::numeric<=(old.payload->>'revision')::numeric
        or (select jsonb_agg(value order by ordinality) from jsonb_array_elements(p_payload->'history') with ordinality where ordinality<=jsonb_array_length(old.payload->'history')+1)
          is distinct from (old.payload->'history')||jsonb_build_array(prior) then
        raise check_violation using message='Prior revisions must be preserved';
      end if;
    end if;
  end if;
  insert into paramount_sync.documents(workspace_id,id,kind,property_id,payload,version,updated_by)
    values(p_workspace,p_id,p_kind,p_property,p_payload,p_expected+1,auth.uid())
    on conflict(workspace_id,id) do update set payload=excluded.payload,version=excluded.version,updated_by=excluded.updated_by,updated_at=now()
    returning to_jsonb(documents.*) into result;
  insert into paramount_sync.operations values(p_workspace,p_operation,auth.uid(),req,result,now());
  return result;
end $$;
revoke all on all functions in schema paramount_sync from public, anon, authenticated;
revoke all on function public.paramount_sync_list(uuid) from public, anon, authenticated;
revoke all on function public.paramount_sync_write(uuid,uuid,text,uuid,jsonb,bigint,uuid) from public, anon, authenticated;
grant execute on function public.paramount_sync_list(uuid) to authenticated;
grant execute on function public.paramount_sync_write(uuid,uuid,text,uuid,jsonb,bigint,uuid) to authenticated;
commit;

