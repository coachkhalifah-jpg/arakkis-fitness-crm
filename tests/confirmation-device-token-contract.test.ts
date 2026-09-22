import { describe, expect, it } from "vitest";

// Keep the confirmation-token contract aligned with get_registration_confirmation /
// phase10_issue_participant_device_token callers in device.ts.
const confirmationTokenPattern = /^[A-Za-z0-9_-]{40,60}$/;

describe("confirmation device token contract", () => {
  it("accepts URL-safe confirmation tokens used by remember-device", () => {
    const token = "hC18q8NfYutevrz-z3UCgj1ejYaxHPD9p9UjdxbvuDA";
    expect(token).toMatch(confirmationTokenPattern);
  });

  it("rejects empty or malformed tokens before the device RPC", () => {
    expect("").not.toMatch(confirmationTokenPattern);
    expect("short").not.toMatch(confirmationTokenPattern);
    expect("+++invalid+++token+++with+++plus+++signs+++").not.toMatch(confirmationTokenPattern);
  });
});
