export type AdminWorkspaceMenuItem = {
  href: string;
  label: string;
  download?: string;
};

export function isAdminWorkspaceItemActive(pathname: string, href: string) {
  const basePath = href.split("?")[0].replace(/\/$/, "") || "/";
  if (basePath === "/admin") return pathname === "/admin";
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function getAdminWorkspaceMenuItems(isSystemAdmin = true): AdminWorkspaceMenuItem[] {
  return [
    { href: "/admin/events", label: "Events" },
    { href: "/admin/venues", label: "Venues" },
    ...(isSystemAdmin
      ? [
          { href: "/admin/organizations", label: "Organizations" },
          { href: "/admin/participants", label: "People" },
          { href: "/admin/invitations", label: "Invitations" },
          { href: "/admin/community", label: "Community" },
          { href: "/admin/design-assets", label: "Design" },
        ]
      : []),
  ];
}
