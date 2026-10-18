import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Admin password show/hide", () => {
  const input = readFileSync(join(root, "src/components/auth/password-input.tsx"), "utf8");
  const signIn = readFileSync(join(root, "src/components/auth/sign-in-form.tsx"), "utf8");
  const reset = readFileSync(join(root, "src/components/auth/password-reset-form.tsx"), "utf8");
  const invite = readFileSync(join(root, "src/components/auth/accept-invitation-form.tsx"), "utf8");
  const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

  it("exposes an accessible Show/Hide toggle on PasswordInput", () => {
    expect(input).toContain('aria-label={visible ? "Hide password" : "Show password"}');
    expect(input).toContain("aria-pressed={visible}");
    expect(input).toContain('type={visible ? "text" : "password"}');
  });

  it("wires PasswordInput into admin auth forms", () => {
    expect(signIn).toContain("PasswordInput");
    expect(reset).toContain("PasswordInput");
    expect(invite).toContain("PasswordInput");
  });

  it("styles the password field toggle", () => {
    expect(css).toContain(".ops-auth-password-field");
    expect(css).toContain(".ops-auth-password-toggle");
  });
});
