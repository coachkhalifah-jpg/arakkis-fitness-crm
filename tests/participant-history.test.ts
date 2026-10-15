import { describe, expect, it } from "vitest";
import {
  isCancellationRegistration,
  isQualifyingRegistration,
  isUpcomingRegistration,
  organizationAffiliationLabel,
  participantHistoryDetailLabel,
  participantHistoryLabel,
} from "@/lib/participants/history";

describe("participant history classification", () => {
  it("treats one active registration as new", () => {
    expect(
      participantHistoryLabel(
        [{ registration_status: "REGISTERED", registration_outcome: "ACTIVE" }].filter(
          isQualifyingRegistration,
        ).length,
      ),
    ).toBe("New member");
  });

  it("treats multiple active registrations as returning", () => {
    const registrations = [
      { registration_status: "REGISTERED", registration_outcome: "ACTIVE" },
      { registration_status: "REGISTERED", registration_outcome: "ACTIVE" },
    ];
    expect(participantHistoryLabel(registrations.filter(isQualifyingRegistration).length)).toBe(
      "Returning member",
    );
  });

  it("excludes cancelled, merged, and invalid registrations", () => {
    const registrations = [
      { registration_status: "CANCELLED", registration_outcome: "PARTICIPANT_CANCELLED" },
      { registration_status: "CANCELLED", registration_outcome: "MERGED_DUPLICATE" },
      { registration_status: "PENDING", registration_outcome: "ACTIVE" },
    ];
    expect(participantHistoryLabel(registrations.filter(isQualifyingRegistration).length)).toBe(
      "New member",
    );
  });

  it("clarifies New/Returning with qualifying-registration counts", () => {
    expect(participantHistoryDetailLabel(0)).toBe("No qualifying registrations yet");
    expect(participantHistoryDetailLabel(1)).toBe("1 qualifying registration");
    expect(participantHistoryDetailLabel(3)).toBe("3 qualifying registrations");
  });

  it("counts cancellations excluding merge cleanup", () => {
    const registrations = [
      { registration_status: "CANCELLED", registration_outcome: "PARTICIPANT_CANCELLED" },
      { registration_status: "CANCELLED", registration_outcome: "ADMIN_CANCELLED" },
      { registration_status: "CANCELLED", registration_outcome: "EVENT_CANCELLED" },
      { registration_status: "CANCELLED", registration_outcome: "MERGED_DUPLICATE" },
      { registration_status: "REGISTERED", registration_outcome: "ACTIVE" },
    ];
    expect(registrations.filter(isCancellationRegistration)).toHaveLength(3);
  });

  it("marks only future active registrations as upcoming", () => {
    const now = new Date("2026-10-15T12:00:00.000Z");
    const active = { registration_status: "REGISTERED", registration_outcome: "ACTIVE" };
    const cancelled = {
      registration_status: "CANCELLED",
      registration_outcome: "PARTICIPANT_CANCELLED",
    };
    expect(isUpcomingRegistration(active, { starts_at: "2026-10-16T12:00:00.000Z" }, now)).toBe(
      true,
    );
    expect(isUpcomingRegistration(active, { starts_at: "2026-10-14T12:00:00.000Z" }, now)).toBe(
      false,
    );
    expect(isUpcomingRegistration(cancelled, { starts_at: "2026-10-16T12:00:00.000Z" }, now)).toBe(
      false,
    );
    expect(isUpcomingRegistration(active, null, now)).toBe(false);
  });

  it("uses the same fallback for list and detail affiliation presentation", () => {
    const cases = [
      [null, "Organization unavailable"],
      [undefined, "Organization unavailable"],
      [{ name: "Old Organization", active_status: "ARCHIVED" }, "Organization unavailable"],
      [{ name: "Current Organization", active_status: "ACTIVE" }, "Current Organization"],
    ] as const;

    for (const [organization, expected] of cases) {
      // The shared formatter is consumed by both People List and Person Detail.
      expect(organizationAffiliationLabel(organization)).toBe(expected);
    }
  });

  it("never uses legacy affiliation fallback wording", () => {
    expect(organizationAffiliationLabel(null)).toBe("Organization unavailable");
  });
});
