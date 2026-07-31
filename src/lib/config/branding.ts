import "server-only";

export const publicBrand = {
  organizationName: "Fitness Event CRM",
  tagline: "Small groups. Good energy. Come as you are.",
  logoPath: "/brand/logo-mark.svg",
  desktopBackgroundPath: "/brand/event-hub-background.svg",
  mobileBackgroundPath: "/brand/event-hub-background-mobile.svg",
  fallbackBackground: "linear-gradient(135deg, #f7f8f5 0%, #dceee8 48%, #f4d9c9 100%)",
  overlayStrength: 0.86,
  links: [{ label: "Home", href: "/" }],
} as const;
