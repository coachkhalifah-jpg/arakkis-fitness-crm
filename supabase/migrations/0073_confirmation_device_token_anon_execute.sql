-- Confirmation-bearer device issuance: the raw confirmation token is already a
-- capability on the confirmation page (same trust model as get_registration_confirmation).
-- Allow anon/authenticated execute so Save on this device does not depend solely on
-- service-role wiring for this UX path. Function remains security definer and still
-- validates the confirmation token hash, expiry, and active participant.
grant execute on function public.phase10_issue_participant_device_token(text)
  to anon, authenticated;
