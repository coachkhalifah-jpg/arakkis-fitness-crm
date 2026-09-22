import { describe, expect, it } from "vitest";
import {
  actionErrorFromRegistrationFailure,
  noReservedClassError,
  registrationOutcomeMessage,
  successfulRegistrationResults,
} from "@/lib/registration/result-outcomes";

describe("registration result outcomes", () => {
  it("detects successful reservations", () => {
    expect(
      successfulRegistrationResults([
        { success: false, reason: "FULL" },
        { success: true, event_id: "a" },
      ]),
    ).toHaveLength(1);
    expect(successfulRegistrationResults([{ success: false, reason: "CLOSED" }])).toHaveLength(0);
    expect(successfulRegistrationResults(undefined)).toHaveLength(0);
  });

  it("maps reservation failure reasons to participant-facing copy", () => {
    expect(registrationOutcomeMessage([{ success: false, reason: "FULL" }])).toBe(
      "This class filled before your selection could be reserved.",
    );
    expect(
      registrationOutcomeMessage([
        { success: false, reason: "CLOSED" },
        { success: false, reason: "ALREADY_REGISTERED" },
      ]),
    ).toContain("Registration closed before your selection could be reserved.");
    expect(
      registrationOutcomeMessage([
        { success: false, reason: "CLOSED" },
        { success: false, reason: "ALREADY_REGISTERED" },
      ]),
    ).toContain("You already have an active registration for this class.");
    expect(registrationOutcomeMessage([])).toMatch(/choose another date/i);
  });

  it("builds and recovers no-reserved-class action errors", () => {
    const error = noReservedClassError([{ success: false, reason: "FULL" }]);
    expect(error.message).toBe("registration completed without a reserved class (FULL)");
    expect(actionErrorFromRegistrationFailure(error)).toBe(
      "This class filled before your selection could be reserved.",
    );
    expect(actionErrorFromRegistrationFailure(new Error("registration unavailable"))).toBeNull();
  });
});
