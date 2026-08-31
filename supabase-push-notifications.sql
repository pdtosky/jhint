-- Production and administrator work push subscriptions and delivery history are intentionally
-- separated from public.app_state so they cannot be overwritten with app data.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null,
  role text not null check (role in ('production', 'admin')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  enabled boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_failure_code integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_role_check;
alter table public.push_subscriptions
  add constraint push_subscriptions_role_check check (role in ('production', 'admin'));

create index if not exists push_subscriptions_user_enabled_idx
  on public.push_subscriptions (user_id, enabled);

create table if not exists public.push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('morning', 'evening')),
  delivery_date date not null,
  status text not null check (status in ('pending', 'success', 'failed')),
  attempts integer not null default 1,
  detail jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, delivery_date)
);

alter table public.push_subscriptions enable row level security;
alter table public.push_delivery_log enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.push_delivery_log from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;
grant select, insert, update, delete on table public.push_delivery_log to service_role;

drop policy if exists "push subscriptions server only" on public.push_subscriptions;
create policy "push subscriptions server only"
  on public.push_subscriptions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "push delivery log server only" on public.push_delivery_log;
create policy "push delivery log server only"
  on public.push_delivery_log
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.get_jhint_push_server_config()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'publicKey', max(decrypted_secret) filter (where name = 'jhint_vapid_public_key'),
    'privateKey', max(decrypted_secret) filter (where name = 'jhint_vapid_private_key'),
    'subject', coalesce(max(decrypted_secret) filter (where name = 'jhint_vapid_subject'), 'mailto:tape@jhint.net'),
    'cronSecret', max(decrypted_secret) filter (where name = 'jhint_push_cron_secret')
  )
  from vault.decrypted_secrets
  where name in ('jhint_vapid_public_key', 'jhint_vapid_private_key', 'jhint_vapid_subject', 'jhint_push_cron_secret');
$$;

revoke all on function public.get_jhint_push_server_config() from public, anon, authenticated;
grant execute on function public.get_jhint_push_server_config() to service_role;

create or replace function public.claim_jhint_push_delivery(
  p_user_id uuid,
  p_kind text,
  p_delivery_date date,
  p_detail jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  if p_kind not in ('morning', 'evening') then
    raise exception 'invalid push delivery kind';
  end if;

  insert into public.push_delivery_log (
    user_id, kind, delivery_date, status, attempts, detail, updated_at
  ) values (
    p_user_id, p_kind, p_delivery_date, 'pending', 1, coalesce(p_detail, '{}'::jsonb), now()
  )
  on conflict (user_id, kind, delivery_date) do update
  set status = 'pending',
      attempts = public.push_delivery_log.attempts + 1,
      detail = excluded.detail,
      updated_at = now()
  where public.push_delivery_log.status = 'failed'
     or (
       public.push_delivery_log.status = 'pending'
       and public.push_delivery_log.updated_at < now() - interval '10 minutes'
     )
  returning id into claimed_id;

  return claimed_id is not null;
end;
$$;

revoke all on function public.claim_jhint_push_delivery(uuid, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.claim_jhint_push_delivery(uuid, text, date, jsonb) to service_role;

-- Secrets must be created in Supabase Vault before scheduling these jobs.
-- Cron uses UTC: 00:00 UTC = 09:00 KST, 12:00 UTC = 21:00 KST.
do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname in ('jhint-production-start-reminder', 'jhint-production-end-reminder')
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end
$$;

select cron.schedule(
  'jhint-production-start-reminder',
  '0 0 * * 1-5',
  $$
    select net.http_post(
      url := 'https://jhint.vercel.app/api/push-reminders?kind=morning',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'jhint_push_cron_secret'
        )
      ),
      body := '{"source":"supabase-cron"}'::jsonb,
      timeout_milliseconds := 10000
    );
  $$
);

select cron.schedule(
  'jhint-production-end-reminder',
  '0 12 * * 1-5',
  $$
    select net.http_post(
      url := 'https://jhint.vercel.app/api/push-reminders?kind=evening',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'jhint_push_cron_secret'
        )
      ),
      body := '{"source":"supabase-cron"}'::jsonb,
      timeout_milliseconds := 10000
    );
  $$
);
