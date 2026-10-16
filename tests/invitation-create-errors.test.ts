import { describe, expect, it } from "vitest";
import {
  mapInvitationCreateError,
  mapInvitationRegenerateError,
} from "@/lib/auth/invitation-create-errors";

describe("mapInvitationCreateError", () => {
  it("returns the generic message when no error is present", () => {
    expect(mapInvitationCreateError(null)).toBe("Invitation could not be created.");
    expect(mapInvitationCreateError(undefined)).toBe("Invitation could not be created.");
    expect(mapInvitationCreateError({})).toBe("Invitation could not be created.");
  });

  it("maps stuck pending-reservation conflicts to an actionable message", () => {
    expect(
      mapInvitationCreateError({
        message: "pending invitation conflict could not be resolved",
        code: "P0001",
      }),
    ).toContain("conflicting reservation");
  });

  it("maps unavailable organization assignments", () => {
    expect(
      mapInvitationCreateError({ message: "invalid invitation assignments" }),
    ).toContain("organization is unavailable");
  });

  it("maps missing RPC / permission failures without leaking internals", () => {
    const message = mapInvitationCreateError({
      message: "Could not find the function public.create_admin_invitation",
      code: "PGRST202",
    });
    expect(message).toContain("invitation service is unavailable");
    expect(message).not.toContain("create_admin_invitation");
    expect(message).not.toContain("PGRST202");
  });

  it("maps bytea decode failures as service unavailable", () => {
    expect(
      mapInvitationCreateError({
        message: 'invalid input syntax for type bytea: "\\xnothex"',
        code: "22P02",
      }),
    ).toContain("invitation service is unavailable");
  });
});

describe("mapInvitationRegenerateError", () => {
  it("maps permission / missing function failures", () => {
    expect(
      mapInvitationRegenerateError({
        message: "permission denied for function regenerate_admin_invitation",
        code: "42501",
      }),
    ).toContain("invitation service is unavailable");
  });

  it("maps false RPC return to no-longer-pending", () => {
    expect(mapInvitationRegenerateError(null, true)).toContain("no longer pending");
  });

  it("maps unauthorized actor", () => {
    expect(
      mapInvitationRegenerateError({ message: "administrator is not authorized" }),
    ).toContain("System Admin authorization failed");
  });
});
