export function safeAdminRedirect(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  if (value.includes("\\") || value.includes("://") || !value.startsWith("/admin")) {
    return "/admin";
  }

  return value;
}

export function signInPath(next?: string) {
  return `/admin/sign-in?next=${encodeURIComponent(safeAdminRedirect(next))}`;
}
