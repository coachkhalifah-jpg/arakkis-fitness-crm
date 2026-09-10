export function safeAdminRedirect(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  if (value.includes("\\") || value.includes("://") || !value.startsWith("/admin")) {
    return "/admin";
  }

  return value;
}

export const PASSWORD_UPDATE_PATH = "/admin/update-password";

export function safeRecoveryRedirect(_value: FormDataEntryValue | string | null | undefined) {
  return PASSWORD_UPDATE_PATH;
}

export function signInPath(next?: string) {
  return `/admin/sign-in?next=${encodeURIComponent(safeAdminRedirect(next))}`;
}
