import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsContent } from "@/lib/registration/calendar";
import { normalizeEmail, normalizeName, normalizePhone } from "@/lib/registration/normalization";

const event = {
  eventId: "event-a",
  name: "Spring, Strength",
  description: "Bring a mat.",
  participantInstructions: "Arrive\nearly.",
  startsAt: "2026-08-01T14:00:00.000Z",
  endsAt: "2026-08-01T15:00:00.000Z",
  timezone: "America/New_York",
  venueName: "Community Center",
  venueStreet: "1 Main St",
  venueCity: "Alexandria",
  venueState: "VA",
  venuePostalCode: "22301",
};

describe("Phase 4 registration normalization", () => {
  it("normalizes Unicode names without changing display input", () => {
    expect(normalizeName("  José   van   Dyke ")).toBe("josé van dyke");
  });

  it("normalizes domestic and international phones to E.164", () => {
    expect(normalizePhone("(703) 555-1212", "US").e164).toBe("+17035551212");
    expect(normalizePhone("020 7946 0018", "GB").e164).toBe("+442079460018");
    expect(normalizePhone("+44 20 7946 0018", "US").e164).toBe("+442079460018");
  });

  it("trims and lowercases optional email", () => {
    expect(normalizeEmail("  PERSON@Example.COM ")).toBe("person@example.com");
    expect(normalizeEmail("")).toBeNull();
  });
});

describe("calendar exports", () => {
  it("escapes ICS text and emits CRLF with stable UIDs", () => {
    const content = icsContent([event]);
    expect(content).toContain("UID:event-a@fitness-event-crm");
    expect(content).toContain("SUMMARY:Spring\\, Strength");
    expect(content).toContain("DESCRIPTION:Bring a mat.\\n\\nArrive\\nearly.");
    expect(content).toMatch(/\r\nEND:VCALENDAR\r\n$/);
  });

  it("encodes Google Calendar fields and timezone", () => {
    const url = googleCalendarUrl(event);
    expect(url).toContain("calendar.google.com/calendar/render?");
    expect(url).toContain("ctz=America%2FNew_York");
    expect(url).toContain("text=Spring%2C+Strength");
  });
});
