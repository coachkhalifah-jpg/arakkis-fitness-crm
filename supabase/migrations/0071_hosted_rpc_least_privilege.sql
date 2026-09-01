-- RC2: hosted least-privilege correction for server-only participant RPCs.
-- Keep these corrections explicit for hosted role ACL state.

revoke execute on function public.phase10_issue_participant_device_token(text)
  from anon, authenticated;
revoke execute on function public.phase10_resolve_participant_device_token(text)
  from anon, authenticated;
revoke execute on function public.get_participant_booking_by_confirmation(text, uuid)
  from anon, authenticated;

grant execute on function public.phase10_issue_participant_device_token(text)
  to service_role;
grant execute on function public.phase10_resolve_participant_device_token(text)
  to service_role;
grant execute on function public.get_participant_booking_by_confirmation(text, uuid)
  to service_role;
