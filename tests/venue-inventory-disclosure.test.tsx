import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  VenueInventoryDisclosure,
  VenueInventoryDisclosureContent,
  VenueInventoryDisclosureToggle,
} from "@/components/admin/venue-inventory-disclosure";
import {
  isVenueInventorySectionOpen,
  resolveVenueInventorySection,
} from "@/lib/admin/venue-inventory";

describe("Venue inventory URL section state", () => {
  afterEach(cleanup);

  it.each([
    [undefined, "organization"],
    ["", "organization"],
    ["organization", "organization"],
    ["public", "public"],
    ["invalid", "organization"],
  ])("resolves section=%s to %s", (section, expected) => {
    expect(resolveVenueInventorySection(section)).toBe(expected);
  });

  it("maps the rendered disclosure state to the resolved URL section", () => {
    const activeSection = resolveVenueInventorySection("public");
    expect(isVenueInventorySectionOpen(activeSection, "public")).toBe(true);
    expect(isVenueInventorySectionOpen(activeSection, "organization")).toBe(false);

    const defaultSection = resolveVenueInventorySection("invalid");
    expect(isVenueInventorySectionOpen(defaultSection, "organization")).toBe(true);
    expect(isVenueInventorySectionOpen(defaultSection, "public")).toBe(false);
  });

  it.each([
    ["public", "Public venues", true],
    ["organization", "Organization venues", false],
  ])("renders %s as the requested expanded state", (section, label, publicOpen) => {
    const activeSection = resolveVenueInventorySection(section);
    render(
      <VenueInventoryDisclosure defaultOpen={isVenueInventorySectionOpen(activeSection, "public")}>
        <VenueInventoryDisclosureToggle title={label} />
        <VenueInventoryDisclosureContent>Visible venue rows</VenueInventoryDisclosureContent>
      </VenueInventoryDisclosure>,
    );

    expect(screen.getByRole("button", { name: new RegExp(label) })).toHaveAttribute(
      "aria-expanded",
      String(publicOpen),
    );
    if (publicOpen) {
      expect(screen.getByText("Visible venue rows")).not.toHaveAttribute("hidden");
    } else {
      expect(screen.getByText("Visible venue rows")).toHaveAttribute("hidden");
    }
  });
});
