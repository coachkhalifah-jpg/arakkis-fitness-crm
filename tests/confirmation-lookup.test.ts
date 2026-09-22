import { describe, expect, it } from "vitest";
import { confirmationLookupStatus } from "@/lib/registration/confirmation-lookup";

describe("confirmationLookupStatus", () => {
  it("detects expired confirmation RPC failures", () => {
    expect(confirmationLookupStatus("expired confirmation")).toBe("expired");
    expect(confirmationLookupStatus('{"code":"42501","message":"expired confirmation"}')).toBe(
      "expired",
    );
  });

  it("treats other failures as invalid", () => {
    expect(confirmationLookupStatus("invalid confirmation")).toBe("invalid");
    expect(confirmationLookupStatus(undefined)).toBe("invalid");
    expect(confirmationLookupStatus("")).toBe("invalid");
  });
});
