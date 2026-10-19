begin;
set local lock_timeout = '2s';
set local statement_timeout = '10s';

alter table public.app_state
  add column if not exists sync_revision bigint not null default 0;

create or replace function public.jhint_bump_app_state_revision()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.sync_revision := old.sync_revision + 1;
  return new;
end;
$$;

revoke all on function public.jhint_bump_app_state_revision() from public;

create trigger jhint_app_state_revision
before update on public.app_state
for each row execute function public.jhint_bump_app_state_revision();

-- Verify legacy writes and attempts to supply a revision on temporary data only.
create temporary table jhint_revision_check (
  payload jsonb not null,
  sync_revision bigint not null default 0
) on commit drop;
create trigger jhint_revision_check_trigger
before update on jhint_revision_check
for each row execute function public.jhint_bump_app_state_revision();
insert into jhint_revision_check(payload) values ('{}');
do $$
declare
  revision bigint;
begin
  update jhint_revision_check set payload = '{"test":true}' returning sync_revision into revision;
  if revision <> 1 then raise exception 'Legacy update did not advance revision'; end if;
  update jhint_revision_check set sync_revision = 0 returning sync_revision into revision;
  if revision <> 2 then raise exception 'Client supplied revision was not overridden'; end if;
end;
$$;
commit;
