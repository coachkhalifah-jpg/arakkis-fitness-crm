import { describe, expect, it } from "vitest";
import { isAlreadyRegisteredOutcome } from "@/lib/registration/result-outcomes";
import { rethrowNextControlFlow } from "@/lib/navigation/rethrow-next";

describe("isAlreadyRegisteredOutcome", () => {
  it("detects already-registered participant copy", () => {
    expect(
      isAlreadyRegisteredOutcome(
        "You already have an active registration for this class. Use a saved confirmation or booking link if this browser is not remembered.",
      ),
    ).toBe(true);
    expect(
      isAlreadyRegisteredOutcome("This class filled before your selection could be reserved."),
    ).toBe(false);
    expect(isAlreadyRegisteredOutcome(undefined)).toBe(false);
  });
});

describe("rethrowNextControlFlow", () => {
  it("rethrows Next redirect control-flow errors", () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/admin/access-denied;307;",
    });
    expect(() => rethrowNextControlFlow(redirectError)).toThrow(redirectError);
  });

  it("leaves ordinary errors alone", () => {
    expect(() => rethrowNextControlFlow(new Error("registration unavailable"))).not.toThrow();
  });
});
