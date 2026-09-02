-- Company-wide text chat for approved production-control accounts.
-- Messages are server-managed; browser roles receive changes only through an
-- authenticated private Realtime Broadcast channel.

create table if not exists public.company_chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_message_id uuid not null unique,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  sender_role text not null,
  body text not null,
  mentioned_user_ids uuid[] not null default '{}'::uuid[],
  notify_all boolean not null default false,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_id uuid references auth.users(id) on delete set null,
  deleted_by_name text,
  constraint company_chat_sender_role_check check (
    sender_role in ('production', 'admin', 'sales', 'office', 'quality', 'shipping')
  ),
  constraint company_chat_body_length_check check (
    char_length(btrim(body)) between 1 and
      case when sender_role = 'admin' then 10000 else 100 end
  ),
  constraint company_chat_notify_all_admin_check check (
    not notify_all or sender_role = 'admin'
  ),
  constraint company_chat_pin_admin_check check (
    not is_pinned or sender_role = 'admin'
  ),
  constraint company_chat_mention_count_check check (
    cardinality(mentioned_user_ids) <= 20
  )
);

-- Keep existing installations in sync when additional approved employee roles
-- are granted access after the table was first created.
alter table public.company_chat_messages
  drop constraint if exists company_chat_sender_role_check;
alter table public.company_chat_messages
  add constraint company_chat_sender_role_check check (
    sender_role in ('production', 'admin', 'sales', 'office', 'quality', 'shipping')
  );

create index if not exists company_chat_messages_created_at_idx
  on public.company_chat_messages (created_at desc);
create index if not exists company_chat_messages_pinned_idx
  on public.company_chat_messages (is_pinned, created_at desc)
  where deleted_at is null;
create index if not exists company_chat_messages_sender_rate_idx
  on public.company_chat_messages (sender_id, created_at desc);
create index if not exists company_chat_messages_deleted_by_idx
  on public.company_chat_messages (deleted_by_id)
  where deleted_by_id is not null;

create table if not exists public.company_chat_reads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_read_message_id uuid references public.company_chat_messages(id) on delete set null,
  last_read_at timestamptz not null default '1970-01-01 00:00:00+00'::timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists company_chat_reads_last_message_idx
  on public.company_chat_reads (last_read_message_id)
  where last_read_message_id is not null;

alter table public.company_chat_messages enable row level security;
alter table public.company_chat_reads enable row level security;

revoke all on table public.company_chat_messages from public, anon, authenticated;
revoke all on table public.company_chat_reads from public, anon, authenticated;
grant select, insert, update, delete on table public.company_chat_messages to service_role;
grant select, insert, update, delete on table public.company_chat_reads to service_role;

drop policy if exists "company chat server only" on public.company_chat_messages;
create policy "company chat server only"
  on public.company_chat_messages
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "company chat reads server only" on public.company_chat_reads;
create policy "company chat reads server only"
  on public.company_chat_reads
  for all
  to service_role
  using (true)
  with check (true);

create schema if not exists private;

create or replace function private.broadcast_company_chat_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, realtime
as $function$
begin
  perform realtime.broadcast_changes(
    'company-chat',
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$function$;

revoke all on function private.broadcast_company_chat_changes() from public, anon, authenticated;
grant execute on function private.broadcast_company_chat_changes() to service_role;

drop trigger if exists broadcast_company_chat_changes on public.company_chat_messages;
create trigger broadcast_company_chat_changes
after insert or update or delete
on public.company_chat_messages
for each row
execute function private.broadcast_company_chat_changes();

drop policy if exists "approved accounts receive company chat" on realtime.messages;
drop policy if exists "administrator and office receive company chat" on realtime.messages;

create or replace function private.is_company_chat_member()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth
as $function$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and coalesce(raw_app_meta_data ->> 'jhint_role', '') in (
        'production', 'admin', 'sales', 'office', 'quality', 'shipping',
        'worker', 'viewer', 'general'
      )
  );
$function$;

revoke all on function private.is_company_chat_member() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_company_chat_member() to authenticated;

create policy "approved accounts receive company chat"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'company-chat'
  and (select private.is_company_chat_member())
);

-- Existing Web Push subscriptions are reused for chat mentions. Keep the
-- production reminder query restricted in application code, while allowing
-- every approved employee account to register a device for chat mentions.
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_role_check;
alter table public.push_subscriptions
  add constraint push_subscriptions_role_check check (
    role in ('production', 'admin', 'sales', 'office', 'quality', 'shipping')
  );
