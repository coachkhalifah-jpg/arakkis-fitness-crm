import "server-only";

export const publicBrand = {
  organizationName: "Arakkis",
  tagline: "Small groups. Good energy. Come as you are.",
  logoPath: "/brand/arakkis-logo-balanced.png",
  desktopBackgroundPath: "/brand/event-hub-background.svg",
  mobileBackgroundPath: "/brand/event-hub-background-mobile.svg",
  desktopFocalPosition: "center center",
  mobileFocalPosition: "center center",
  fallbackBackground: "linear-gradient(135deg, #f7f8f5 0%, #dceee8 48%, #f4d9c9 100%)",
  overlayStrength: 0.86,
  links: [
    { label: "Home", href: "/", icon: "⌂" },
    { label: "Contact", href: "mailto:hello@example.test", icon: "✉" },
  ],
} as const;
