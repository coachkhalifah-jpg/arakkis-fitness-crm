export const adminVisualAssets = {
  pageBackgrounds: {
    workspace: "/admin-assets/page-backgrounds/workspace.jpg",
    events: "/admin-assets/page-backgrounds/events.svg",
    organizations: "/admin-assets/page-backgrounds/organizations.svg",
    venues: "/admin-assets/page-backgrounds/venues.svg",
    participants: "/admin-assets/page-backgrounds/participants.svg",
    invitations: "/admin-assets/page-backgrounds/invitations.svg",
  },
  eventCards: {
    boxing: "/admin-assets/event-cards/boxing.svg",
    strength: "/admin-assets/event-cards/strength.svg",
    yoga: "/admin-assets/event-cards/yoga.svg",
    communityFitness: "/admin-assets/event-cards/community-fitness.svg",
    default: "/admin-assets/event-cards/default.svg",
  },
  focalPositions: { page: "center", event: "center" },
  overlayStrength: 0.18,
} as const;

export type AdminPageBackground = keyof typeof adminVisualAssets.pageBackgrounds;

export function eventCardAsset(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("box")) return adminVisualAssets.eventCards.boxing;
  if (normalized.includes("strength") || normalized.includes("lift")) {
    return adminVisualAssets.eventCards.strength;
  }
  if (normalized.includes("yoga")) return adminVisualAssets.eventCards.yoga;
  if (normalized.includes("community") || normalized.includes("fitness")) {
    return adminVisualAssets.eventCards.communityFitness;
  }
  return adminVisualAssets.eventCards.default;
}
