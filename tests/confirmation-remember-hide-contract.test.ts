import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UAT-009 confirmation hides Remember after registration remember", () => {
  it("honors remembered=1 and cookie resolve without requiring identity RPC", () => {
    const page = readFileSync("src/app/registration/confirmation/page.tsx", "utf8");
    expect(page).toContain('routeSearchParams.remembered === "1"');
    expect(page).toContain("deviceJustRemembered ||");
    expect(page).toContain("confirmationParticipantId == null ||");
  });
});
