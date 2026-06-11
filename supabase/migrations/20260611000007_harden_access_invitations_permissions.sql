drop policy if exists "Allow all operations on access_invitations" on public.access_invitations;

revoke all on table public.access_invitations from anon, authenticated;
