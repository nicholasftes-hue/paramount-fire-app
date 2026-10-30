-- REVIEW ONLY: never run automatically. No changes to existing properties/auth.
-- Owner must review retention, access and backups before applying in Supabase.
begin;
create table public.main_app_snapshots (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  payload jsonb not null,
  constraint main_app_snapshot_shape check (coalesce((
    payload->>'application' = 'paramount-main-app'
    and payload->>'version' = '1'
    and payload->>'scope' = user_id::text
    and jsonb_typeof(payload->'records') = 'array'
    and octet_length(payload::text) <= 10000000
  ), false))
);
alter table public.main_app_snapshots enable row level security;
alter table public.main_app_snapshots force row level security;
revoke all on public.main_app_snapshots from anon, authenticated;
grant select, insert on public.main_app_snapshots to authenticated;
create policy own_snapshots_read on public.main_app_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy own_snapshots_append on public.main_app_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);
create index main_app_snapshots_owner_date
  on public.main_app_snapshots (user_id, created_at desc);
-- No UPDATE/DELETE policies or grants: snapshots are append-only for app users.
commit;
