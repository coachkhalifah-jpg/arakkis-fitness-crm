-- Reaffirm service_role EXECUTE on Host Admin invitation RPCs used by the
-- privileged Next.js client. create_admin_invitation is re-granted in 0013/0059/0085;
-- regenerate_admin_invitation was granted only in 0020 and never reaffirmed.
-- Safe to re-run: revoke from client roles, then grant service_role.

revoke all on function public.create_admin_invitation(text, bytea, timestamptz, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.create_admin_invitation(text, bytea, timestamptz, uuid, uuid[])
  to service_role;

revoke all on function public.regenerate_admin_invitation(uuid, bytea, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.regenerate_admin_invitation(uuid, bytea, timestamptz, uuid)
  to service_role;

revoke all on function public.revoke_admin_invitation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_admin_invitation(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
