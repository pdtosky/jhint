-- Production schedule normalized storage draft.
-- Apply this only after backing up public.app_state and confirming policies.

create table if not exists public.jhint_orders (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.jhint_requisitions (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.jhint_activities (
  id text primary key,
  order_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.jhint_sops (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.jhint_sop_work_records (
  id text primary key,
  sop_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.jhint_meta (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.jhint_orders enable row level security;
alter table public.jhint_requisitions enable row level security;
alter table public.jhint_activities enable row level security;
alter table public.jhint_sops enable row level security;
alter table public.jhint_sop_work_records enable row level security;
alter table public.jhint_meta enable row level security;

-- Current app still uses the publishable anon key for browser writes.
-- Keep this permissive only while matching the current app_state behavior.
-- When all pages use Supabase Auth sessions, replace these with role-based authenticated policies.
drop policy if exists "anon can read jhint_orders" on public.jhint_orders;
create policy "anon can read jhint_orders" on public.jhint_orders for select to anon using (true);
drop policy if exists "anon can write jhint_orders" on public.jhint_orders;
create policy "anon can write jhint_orders" on public.jhint_orders for all to anon using (true) with check (true);

drop policy if exists "anon can read jhint_requisitions" on public.jhint_requisitions;
create policy "anon can read jhint_requisitions" on public.jhint_requisitions for select to anon using (true);
drop policy if exists "anon can write jhint_requisitions" on public.jhint_requisitions;
create policy "anon can write jhint_requisitions" on public.jhint_requisitions for all to anon using (true) with check (true);

drop policy if exists "anon can read jhint_activities" on public.jhint_activities;
create policy "anon can read jhint_activities" on public.jhint_activities for select to anon using (true);
drop policy if exists "anon can write jhint_activities" on public.jhint_activities;
create policy "anon can write jhint_activities" on public.jhint_activities for all to anon using (true) with check (true);

drop policy if exists "anon can read jhint_sops" on public.jhint_sops;
create policy "anon can read jhint_sops" on public.jhint_sops for select to anon using (true);
drop policy if exists "anon can write jhint_sops" on public.jhint_sops;
create policy "anon can write jhint_sops" on public.jhint_sops for all to anon using (true) with check (true);

drop policy if exists "anon can read jhint_sop_work_records" on public.jhint_sop_work_records;
create policy "anon can read jhint_sop_work_records" on public.jhint_sop_work_records for select to anon using (true);
drop policy if exists "anon can write jhint_sop_work_records" on public.jhint_sop_work_records;
create policy "anon can write jhint_sop_work_records" on public.jhint_sop_work_records for all to anon using (true) with check (true);

drop policy if exists "anon can read jhint_meta" on public.jhint_meta;
create policy "anon can read jhint_meta" on public.jhint_meta for select to anon using (true);
drop policy if exists "anon can write jhint_meta" on public.jhint_meta;
create policy "anon can write jhint_meta" on public.jhint_meta for all to anon using (true) with check (true);

-- One-time seed from the current app_state row.
-- Run after creating the tables. This is safe to repeat because IDs are primary keys.
insert into public.jhint_orders (id, payload, updated_at)
select item->>'id', item, now()
from public.app_state,
jsonb_array_elements(payload->'orders') as item
where id = 'main' and item ? 'id'
on conflict (id) do update set payload = excluded.payload, updated_at = now();

insert into public.jhint_requisitions (id, payload, updated_at)
select item->>'id', item, now()
from public.app_state,
jsonb_array_elements(payload->'requisitions') as item
where id = 'main' and item ? 'id'
on conflict (id) do update set payload = excluded.payload, updated_at = now();

insert into public.jhint_activities (id, order_id, payload, created_at)
select item->>'id', item->>'orderId', item, coalesce(nullif(item->>'timestamp', '')::timestamptz, now())
from public.app_state,
jsonb_array_elements(payload->'activities') as item
where id = 'main' and item ? 'id'
on conflict (id) do update set order_id = excluded.order_id, payload = excluded.payload;

insert into public.jhint_sops (id, payload, updated_at)
select item->>'id', item, now()
from public.app_state,
jsonb_array_elements(coalesce(payload->'sops', '[]'::jsonb)) as item
where id = 'main' and item ? 'id'
on conflict (id) do update set payload = excluded.payload, updated_at = now();

insert into public.jhint_sop_work_records (id, sop_id, payload, created_at)
select item->>'id', item->>'sopId', item, coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
from public.app_state,
jsonb_array_elements(coalesce(payload->'sopWorkRecords', '[]'::jsonb)) as item
where id = 'main' and item ? 'id'
on conflict (id) do update set sop_id = excluded.sop_id, payload = excluded.payload;

insert into public.jhint_meta (id, payload, updated_at)
select 'main',
  jsonb_build_object('sopDeletedIds', coalesce(payload->'sopDeletedIds', '[]'::jsonb)),
  now()
from public.app_state
where id = 'main'
on conflict (id) do update set payload = excluded.payload, updated_at = now();
