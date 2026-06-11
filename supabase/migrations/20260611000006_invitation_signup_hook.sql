create or replace function public.hook_check_invited_signup(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  normalized_email text := lower(btrim(coalesce(event->'user'->>'email', '')));
begin
  if normalized_email = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Adresse email Google introuvable.',
        'http_code', 400
      )
    );
  end if;

  if exists (
    select 1
    from public.judokas
    where email is not null
      and lower(email) = normalized_email
  ) then
    return '{}'::jsonb;
  end if;

  if exists (
    select 1
    from public.access_invitations
    where lower(email) = normalized_email
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Accès non autorisé. Une invitation est requise.',
      'http_code', 403
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_check_invited_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_check_invited_signup(jsonb) from authenticated, anon, public;

grant select on table public.judokas to supabase_auth_admin;
grant select on table public.access_invitations to supabase_auth_admin;

drop policy if exists "Supabase auth admin read judokas for signup hook" on public.judokas;
create policy "Supabase auth admin read judokas for signup hook"
on public.judokas
for select
to supabase_auth_admin
using (true);

drop policy if exists "Supabase auth admin read invitations for signup hook" on public.access_invitations;
create policy "Supabase auth admin read invitations for signup hook"
on public.access_invitations
for select
to supabase_auth_admin
using (true);
