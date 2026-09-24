import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const confirmationPage = readFileSync(
  resolve(process.cwd(), "src/app/registration/confirmation/page.tsx"),
  "utf8",
);

describe("confirmation affirmation microcopy (UAT-008)", () => {
  it("places the exclamation after the first name", () => {
    expect(confirmationPage).toContain("You&apos;re in {firstName}!");
    expect(confirmationPage).not.toContain("You&apos;re in! {firstName}");
  });
});
