export type RegistrationAvailabilityEvent = {
  active_registration_count: number;
  capacity: number;
  availability?: string;
};

export function isUnavailableEvent(event: RegistrationAvailabilityEvent) {
  return (
    event.active_registration_count >= event.capacity ||
    [
      "FULL",
      "CLOSED",
      "CANCELLED",
      "PAUSED",
      "NOT_YET_OPEN",
      "UNPUBLISHED",
      "LEGALLY_BLOCKED",
    ].includes(event.availability ?? "")
  );
}
