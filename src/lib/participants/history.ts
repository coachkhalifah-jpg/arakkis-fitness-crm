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

export function participantHistoryLabel(qualifyingRegistrationCount: number) {
  return qualifyingRegistrationCount > 1 ? "Returning member" : "New member";
}

export function organizationAffiliationLabel(
  organization: { name: string; active_status: string } | null | undefined,
) {
  return organization?.active_status === "ACTIVE" ? organization.name : "Organization unavailable";
}
