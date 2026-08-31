export function bookingManagementHref(registrationId: string, confirmationToken: string) {
  const normalizedRegistrationId = registrationId.trim();
  const normalizedConfirmationToken = confirmationToken.trim();
  if (!normalizedRegistrationId || !normalizedConfirmationToken) return null;

  return `/manage-bookings/${encodeURIComponent(normalizedRegistrationId)}?token=${encodeURIComponent(normalizedConfirmationToken)}`;
}
