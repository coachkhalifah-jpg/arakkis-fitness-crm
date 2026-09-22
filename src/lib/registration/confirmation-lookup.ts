export type ConfirmationLookupStatus = "ok" | "expired" | "invalid";

export function confirmationLookupStatus(
  errorMessage: string | null | undefined,
): ConfirmationLookupStatus {
  const message = (errorMessage ?? "").toLowerCase();
  if (message.includes("expired confirmation")) return "expired";
  return "invalid";
}
