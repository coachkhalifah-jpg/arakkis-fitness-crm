import { describe, expect, it } from "vitest";
import { createInvitationToken, hashInvitationToken } from "@/lib/auth/tokens";
import { safeAdminRedirect } from "@/lib/auth/redirects";

describe("authentication security primitives", () => {
  it("creates an opaque 256-bit invitation token and stores only its hash", () => {
    const first = createInvitationToken();
    const second = createInvitationToken();
    expect(first.token).toHaveLength(43);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashInvitationToken(first.token));
    expect(first.tokenHash).not.toContain(first.token);
    expect(first.tokenHash).toMatch(/^\\x[0-9a-f]{64}$/);
  });

  it("accepts only local admin redirect targets", () => {
    expect(safeAdminRedirect("/admin/events")).toBe("/admin/events");
    expect(safeAdminRedirect("https://evil.example/steal")).toBe("/admin");
    expect(safeAdminRedirect("//evil.example")).toBe("/admin");
    expect(safeAdminRedirect("/\\\\evil.example")).toBe("/admin");
    expect(safeAdminRedirect("/public")).toBe("/admin");
  });
});
