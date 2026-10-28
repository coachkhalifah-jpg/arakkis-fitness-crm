/** DEC-W1 demand waitlist helpers (no seat promise / no promote). */

export const WAITLIST_CAP = 5;

export type WaitlistAvailabilityEvent = {
  availability?: string;
  waitlist_count?: number | null;
  active_registration_count: number;
  capacity: number;
};

export function isFullForWaitlist(event: WaitlistAvailabilityEvent) {
  return event.availability === "FULL" || event.active_registration_count >= event.capacity;
}

/** Public may join when occurrence is Full and active waitlist count is under cap. */
export function isWaitlistJoinOpen(event: WaitlistAvailabilityEvent) {
  const count = event.waitlist_count ?? 0;
  return isFullForWaitlist(event) && count < WAITLIST_CAP;
}

export function waitlistCountLabel(count: number) {
  if (count <= 0) return null;
  return count === 1 ? "1 on waitlist" : `${count} on waitlist`;
}
