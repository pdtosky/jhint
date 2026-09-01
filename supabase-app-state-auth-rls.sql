alter table public.app_state enable row level security;

drop policy if exists "public app_state read main" on public.app_state;
drop policy if exists "public app_state insert main" on public.app_state;
drop policy if exists "public app_state update main" on public.app_state;
drop policy if exists "approved app_state read main" on public.app_state;
drop policy if exists "approved app_state insert main" on public.app_state;
drop policy if exists "approved app_state update main" on public.app_state;

revoke all on table public.app_state from anon;
revoke all on table public.app_state from authenticated;
grant select, insert, update on table public.app_state to authenticated;

create policy "approved app_state read main"
on public.app_state
for select
to authenticated
using (
  id = 'main'
  and (select auth.jwt() -> 'app_metadata' ->> 'jhint_role') in
    ('admin', 'production', 'sales', 'office', 'quality', 'shipping', 'worker')
  and exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as auth_method
    where auth_method ->> 'method' = 'password'
  )
);

create policy "approved app_state insert main"
on public.app_state
for insert
to authenticated
with check (
  id = 'main'
  and (select auth.jwt() -> 'app_metadata' ->> 'jhint_role') in
    ('admin', 'production', 'sales', 'office', 'quality', 'shipping', 'worker')
  and exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as auth_method
    where auth_method ->> 'method' = 'password'
  )
);

create policy "approved app_state update main"
on public.app_state
for update
to authenticated
using (
  id = 'main'
  and (select auth.jwt() -> 'app_metadata' ->> 'jhint_role') in
    ('admin', 'production', 'sales', 'office', 'quality', 'shipping', 'worker')
  and exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as auth_method
    where auth_method ->> 'method' = 'password'
  )
)
with check (
  id = 'main'
  and (select auth.jwt() -> 'app_metadata' ->> 'jhint_role') in
    ('admin', 'production', 'sales', 'office', 'quality', 'shipping', 'worker')
  and exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as auth_method
    where auth_method ->> 'method' = 'password'
  )
);
