import { describe, expect, it } from "vitest";
import { isAdminWorkspaceItemActive } from "@/components/admin/admin-workspace-menu-items";

describe("Admin workspace active route resolution", () => {
  it.each([
    ["/admin/events", "/admin/events", true],
    ["/admin/events/123", "/admin/events", true],
    ["/admin/events/123/qr", "/admin/events", true],
    ["/admin/events-create", "/admin/events", false],
    ["/admin/organizations/123", "/admin/organizations", true],
    ["/admin/venues/123", "/admin/venues", true],
    ["/admin/venue/123", "/admin/venues", false],
    ["/admin", "/admin", true],
    ["/admin/events", "/admin", false],
  ])("resolves %s against %s as %s", (pathname, href, expected) => {
    expect(isAdminWorkspaceItemActive(pathname, href)).toBe(expected);
  });
});
