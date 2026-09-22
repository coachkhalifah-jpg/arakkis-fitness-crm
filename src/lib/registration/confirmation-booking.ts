export type ConfirmationBookingEvent = {
  event_id: string;
  registration_id: string;
  success: boolean;
  name: string;
  description?: string | null;
  participant_instructions?: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_name: string;
  venue_street: string;
  venue_city: string;
  venue_state: string;
  venue_postal_code: string;
  host_organization_name: string;
  communication_url?: string | null;
  communication_label?: string | null;
};

/** Map a successful confirmation-event payload into manage-booking detail shape. */
export function managedBookingFromConfirmationEvent(event: ConfirmationBookingEvent) {
  return {
    registration_id: event.registration_id,
    event_id: event.event_id,
    name: event.name,
    description: event.description ?? null,
    participant_instructions: event.participant_instructions ?? null,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    timezone: event.timezone,
    venue_name: event.venue_name,
    venue_street: event.venue_street,
    venue_city: event.venue_city,
    venue_state: event.venue_state,
    venue_postal_code: event.venue_postal_code,
    host_organization_name: event.host_organization_name,
    location_updated: false,
    registration_status: "REGISTERED",
    registration_outcome: "ACTIVE",
    series_slug: null,
    communication_url: event.communication_url ?? null,
    communication_label: event.communication_label ?? null,
  };
}
