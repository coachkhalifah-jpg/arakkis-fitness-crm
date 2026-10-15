/** Safe System Admin messages for create_admin_invitation failures. Never include tokens or keys. */

export type InvitationCreateFailure = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

const GENERIC_CREATE_ERROR = "Invitation could not be created.";

export function mapInvitationCreateError(error: InvitationCreateFailure | null | undefined): string {
  const haystack = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack) return GENERIC_CREATE_ERROR;

  if (haystack.includes("pending invitation conflict could not be resolved")) {
    return "Invitation could not be created because a conflicting reservation remained. Try again; if it persists, open Invitation history and revoke any pending invite for this email.";
  }
  if (haystack.includes("invalid invitation assignments")) {
    return "Invitation could not be created because the selected organization is unavailable.";
  }
  if (haystack.includes("administrator is not authorized")) {
    return "Invitation could not be created because System Admin authorization failed.";
  }
  if (
    haystack.includes("permission denied") ||
    haystack.includes("42501") ||
    haystack.includes("pgrst202") ||
    haystack.includes("could not find the function")
  ) {
    return "Invitation could not be created because the invitation service is unavailable.";
  }
  if (haystack.includes("invalid invitation")) {
    return "Invitation could not be created because the invitation details were invalid.";
  }

  return GENERIC_CREATE_ERROR;
}

export function logInvitationCreateFailure(
  error: InvitationCreateFailure | null | undefined,
  context: { organizationCount: number; hasEmail: boolean },
) {
  console.error("[admin-invitation] create failed", {
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    organizationCount: context.organizationCount,
    hasEmail: context.hasEmail,
  });
}
