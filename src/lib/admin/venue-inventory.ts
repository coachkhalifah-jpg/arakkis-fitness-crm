export type VenueInventorySection = "organization" | "public";

export function resolveVenueInventorySection(section?: string): VenueInventorySection {
  return section === "public" ? "public" : "organization";
}

export function isVenueInventorySectionOpen(
  activeSection: VenueInventorySection,
  section: VenueInventorySection,
) {
  return activeSection === section;
}
