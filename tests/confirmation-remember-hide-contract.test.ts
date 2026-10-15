import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UAT-009 confirmation hides Remember after registration remember", () => {
  it("honors remembered=1 and cookie resolve without requiring identity RPC", () => {
    const page = readFileSync("src/app/registration/confirmation/page.tsx", "utf8");
    expect(page).toContain('routeSearchParams.remembered === "1"');
    expect(page).toContain("deviceJustRemembered ||");
    expect(page).toContain("confirmationParticipantId == null ||");
  });

  it("submits remember via hidden input and always issues when requested", () => {
    const form = readFileSync("src/components/registration/registration-form.tsx", "utf8");
    const actions = readFileSync("src/lib/registration/actions.ts", "utf8");
    expect(form).toContain('name="rememberDevice" value="on"');
    expect(form).toMatch(
      /rememberDevice && !activeRememberedFirstName \? \([\s\S]*name="rememberDevice"/,
    );
    expect(actions).toContain("continuingAsRemembered");
    expect(actions).not.toContain("!rememberedParticipant;");
    expect(actions).toContain('form.get("rememberDevice") === "on" && !continuingAsRemembered');
  });
});
