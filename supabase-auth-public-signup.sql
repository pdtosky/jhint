-- Allow public email signups while keeping unapproved users out of inspection-log roles.
-- Uninvited users are created in auth.users only and remain pending until the
-- production dashboard administrator assigns app_metadata.jhint_role.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  next_role text;
  next_role_detail text;
  invite_creator uuid;
  creator_email text;
  creator_role text;
begin
  if new.email is null then
    return new;
  end if;

  if lower(new.email) = 'tape@jhint.net' then
    next_role := 'admin';
    next_role_detail := null;
  else
    select role, role_detail, created_by
      into next_role, next_role_detail, invite_creator
    from public.account_invites
    where lower(email) = lower(new.email)
      and used_at is null
    order by created_at desc
    limit 1;
  end if;

  if next_role is not null then
    insert into public.user_profiles (id, email, role, role_detail)
    values (new.id, new.email, next_role, next_role_detail)
    on conflict (id) do update
      set email = excluded.email,
          role = excluded.role,
          role_detail = excluded.role_detail,
          updated_at = now();

    if invite_creator is not null then
      update public.account_invites
      set used_at = now(), created_user_id = new.id
      where lower(email) = lower(new.email)
        and used_at is null;

      select email, role
        into creator_email, creator_role
      from public.user_profiles
      where id = invite_creator;
    end if;

    insert into public.activity_logs (event_type, actor_email, actor_role, target_email, details)
    values (
      'account_created',
      coalesce(creator_email, 'system'),
      coalesce(creator_role, 'system'),
      new.email,
      jsonb_build_object('role', next_role, 'roleDetail', next_role_detail)
    );
  else
    insert into public.activity_logs (event_type, actor_email, actor_role, target_email, details)
    values (
      'account_signup_pending',
      'system',
      'system',
      new.email,
      jsonb_build_object('approvalStatus', 'pending', 'source', 'self_signup')
    );
  end if;

  return new;
end;
$function$;
