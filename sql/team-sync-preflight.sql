-- REVIEW ONLY. Requires explicit owner approval before execution in Supabase.
-- Confirm Dashboard project name "Paramount Fire Test" AND its project ref first.
-- Catalog metadata only: no customer rows, user emails, keys or tokens.
begin transaction read only;
select current_database() as database_name, current_setting('server_version') as postgres_version,
       current_user as operator, to_regnamespace('paramount_sync') as sync_schema;
select n.nspname as schema_name, c.relname, c.relkind,
       pg_get_userbyid(c.relowner) as owner, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','paramount_sync','auth') and c.relkind in ('r','p','v')
order by 1,2;
select table_schema,table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema in ('public','paramount_sync') or (table_schema='auth' and table_name='users')
order by table_schema,table_name,ordinal_position;
select n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','paramount_sync') order by 1,2,3;
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','paramount_sync') order by 1,2,3;
select table_schema,table_name,grantee,privilege_type
from information_schema.role_table_grants
where table_schema in ('public','paramount_sync') order by 1,2,3,4;
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proconfig,p.proacl,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('paramount_sync_list','paramount_sync_write'))
   or (n.nspname='auth' and p.proname='uid')
order by 1,2,3;
select rolname,rolsuper,rolbypassrls from pg_roles
where rolname in (current_user,'postgres','anon','authenticated','service_role');
commit;
