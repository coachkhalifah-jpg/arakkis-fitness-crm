-- Remembered-device resolve and booking management: the raw device token in the
-- HttpOnly cookie is already a capability (same trust model as confirmation-bearer
-- RPCs and migration 0073 for phase10_issue_participant_device_token).
-- Allow anon/authenticated execute so /manage-bookings and returning-home do not
-- depend solely on service-role wiring for this UX path. Functions remain
-- security definer and still validate the device token hash, expiry, revocation,
-- and active participant.
grant execute on function public.phase10_resolve_participant_device_token(text)
  to anon, authenticated;
grant execute on function public.phase10_revoke_participant_device(text)
  to anon, authenticated;
grant execute on function public.get_participant_upcoming_bookings(text)
  to anon, authenticated;
grant execute on function public.get_participant_booking_alternatives(text, uuid)
  to anon, authenticated;
grant execute on function public.manage_participant_booking(text, text, uuid, uuid)
  to anon, authenticated;
grant execute on function public.phase10_issue_participant_confirmation_token(text, uuid)
  to anon, authenticated;
