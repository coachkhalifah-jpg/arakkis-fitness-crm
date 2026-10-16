/** Safe System Admin messages for admin-invitation RPC failures. Never include tokens or keys. */

export type InvitationRpcFailure = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

/** @deprecated Prefer InvitationRpcFailure */
export type InvitationCreateFailure = InvitationRpcFailure;

const GENERIC_CREATE_ERROR = "Invitation could not be created.";
const GENERIC_REGENERATE_ERROR = "Invitation could not be regenerated.";

function errorHaystack(error: InvitationRpcFailure | null | undefined): string {
  return [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isServiceUnavailable(haystack: string): boolean {
  return (
    haystack.includes("permission denied") ||
    haystack.includes("42501") ||
    haystack.includes("pgrst202") ||
    haystack.includes("pgrst203") ||
    haystack.includes("could not find the function") ||
    haystack.includes("invalid input syntax for type bytea") ||
    haystack.includes("22p02")
  );
}

export function mapInvitationCreateError(error: InvitationRpcFailure | null | undefined): string {
  const haystack = errorHaystack(error);

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
  if (isServiceUnavailable(haystack)) {
    return "Invitation could not be created because the invitation service is unavailable.";
  }
  if (haystack.includes("invalid invitation")) {
    return "Invitation could not be created because the invitation details were invalid.";
  }

  return GENERIC_CREATE_ERROR;
}

export function mapInvitationRegenerateError(
  error: InvitationRpcFailure | null | undefined,
  rpcReturnedFalse = false,
): string {
  const haystack = errorHaystack(error);

  if (haystack.includes("administrator is not authorized")) {
    return "Invitation could not be regenerated because System Admin authorization failed.";
  }
  if (isServiceUnavailable(haystack)) {
    return "Invitation could not be regenerated because the invitation service is unavailable.";
  }
  if (rpcReturnedFalse || !haystack) {
    return "Invitation could not be regenerated because it is no longer pending.";
  }

  return GENERIC_REGENERATE_ERROR;
}

export function logInvitationCreateFailure(
  error: InvitationRpcFailure | null | undefined,
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

export function logInvitationRegenerateFailure(
  error: InvitationRpcFailure | null | undefined,
  context: { invitationIdPresent: boolean; rpcReturnedFalse: boolean },
) {
  console.error("[admin-invitation] regenerate failed", {
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    invitationIdPresent: context.invitationIdPresent,
    rpcReturnedFalse: context.rpcReturnedFalse,
  });
}
