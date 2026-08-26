import { describe, expect, it } from "vitest";
import {
  isQualifyingRegistration,
  organizationAffiliationLabel,
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
