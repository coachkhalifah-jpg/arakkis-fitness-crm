export type CalendarEvent = {
  eventId: string;
  name: string;
  description?: string | null;
  participantInstructions?: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName: string;
  venueStreet: string;
  venueCity: string;
  venueState: string;
  venuePostalCode: string;
};

export function googleCalendarUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.name,
    dates: `${icsDate(event.startsAt)}/${icsDate(event.endsAt)}`,
    location: [
      event.venueName,
      event.venueStreet,
      event.venueCity,
      event.venueState,
      event.venuePostalCode,
    ]
      .filter(Boolean)
      .join(", "),
    details: [event.description, event.participantInstructions].filter(Boolean).join("\n\n"),
    ctz: event.timezone,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsDate(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function icsContent(events: CalendarEvent[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Arakkis//Registration//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.eventId}@fitness-event-crm`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(event.startsAt)}`,
      `DTEND:${icsDate(event.endsAt)}`,
      `SUMMARY:${escapeIcs(event.name)}`,
      `LOCATION:${escapeIcs([event.venueName, event.venueStreet, event.venueCity, event.venueState, event.venuePostalCode].filter(Boolean).join(", "))}`,
    );
    const description = [event.description, event.participantInstructions]
      .filter(Boolean)
      .join("\n\n");
    if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
