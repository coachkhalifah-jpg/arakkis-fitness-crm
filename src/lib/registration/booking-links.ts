export function bookingManagementHref(
  registrationId: string,
  confirmationToken: string,
  correlationId?: string,
) {
  const normalizedRegistrationId = registrationId.trim();
  const normalizedConfirmationToken = confirmationToken.trim();
  if (!normalizedRegistrationId || !normalizedConfirmationToken) return null;

  const correlationQuery = correlationId?.trim()
    ? `&correlationId=${encodeURIComponent(correlationId.trim())}`
    : "";
  return `/manage-bookings/${encodeURIComponent(normalizedRegistrationId)}?token=${encodeURIComponent(normalizedConfirmationToken)}${correlationQuery}`;
}
