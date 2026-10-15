export type ParticipantRegistrationHistory = {
  registration_status: string;
  registration_outcome: string;
};

/** Registrations that represent a real participant history entry. */
export function isQualifyingRegistration(registration: ParticipantRegistrationHistory) {
  return (
    registration.registration_status === "REGISTERED" &&
    registration.registration_outcome === "ACTIVE"
  );
}

/** Cancelled registrations that count toward CRM cancellation totals (excludes merge cleanup). */
export function isCancellationRegistration(registration: ParticipantRegistrationHistory) {
  return (
    registration.registration_status === "CANCELLED" &&
    registration.registration_outcome !== "MERGED_DUPLICATE"
  );
}

export function participantHistoryLabel(qualifyingRegistrationCount: number) {
  return qualifyingRegistrationCount > 1 ? "Returning member" : "New member";
}

/** Clarifying subcopy under New/Returning — keeps member-type semantics honest. */
export function participantHistoryDetailLabel(qualifyingRegistrationCount: number) {
  if (qualifyingRegistrationCount <= 0) return "No qualifying registrations yet";
  if (qualifyingRegistrationCount === 1) return "1 qualifying registration";
  return `${qualifyingRegistrationCount} qualifying registrations`;
}

export function organizationAffiliationLabel(
  organization: { name: string; active_status: string } | null | undefined,
) {
  return organization?.active_status === "ACTIVE" ? organization.name : "Organization unavailable";
}

export type RegistrationWithEvent = {
  registration: ParticipantRegistrationHistory & { id: string; event_id: string };
  event: { id: string; starts_at: string } | null | undefined;
};

/** Active bookings whose Event has not started yet. */
export function isUpcomingRegistration(
  registration: ParticipantRegistrationHistory,
  event: { starts_at: string } | null | undefined,
  now: Date = new Date(),
) {
  return Boolean(
    isQualifyingRegistration(registration) && event && new Date(event.starts_at) >= now,
  );
}
