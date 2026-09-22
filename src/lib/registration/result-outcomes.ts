export type RegistrationResultItem = {
  event_id?: string;
  success?: boolean;
  reason?: string | null;
};

const reasonText: Record<string, string> = {
  FULL: "This class filled before your selection could be reserved.",
  CLOSED: "Registration closed before your selection could be reserved.",
  ALREADY_REGISTERED: "You already have an active registration for this class.",
  INELIGIBLE: "You are not eligible for this class.",
  NOT_FOUND: "This class is no longer available.",
};

export const NO_RESERVED_CLASS_ERROR = "registration completed without a reserved class";

export function successfulRegistrationResults(results: RegistrationResultItem[] | undefined) {
  return (results ?? []).filter((item) => item.success);
}

export function registrationOutcomeMessage(results: RegistrationResultItem[] | undefined): string {
  const reasons = [
    ...new Set(
      (results ?? [])
        .filter((item) => !item.success)
        .map((item) => item.reason)
        .filter((reason): reason is string => Boolean(reason)),
    ),
  ];
  if (!reasons.length) {
    return "None of the selected classes could be reserved. Please choose another date and try again.";
  }
  const messages = reasons.map(
    (reason) => reasonText[reason] ?? "This selection could not be reserved.",
  );
  return [...new Set(messages)].join(" ");
}

export function noReservedClassError(results: RegistrationResultItem[] | undefined): Error {
  const reasonCodes = (results ?? [])
    .map((item) => item.reason)
    .filter((reason): reason is string => Boolean(reason));
  if (!reasonCodes.length) return new Error(NO_RESERVED_CLASS_ERROR);
  return new Error(`${NO_RESERVED_CLASS_ERROR} (${[...new Set(reasonCodes)].join(", ")})`);
}

export function isNoReservedClassError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith(NO_RESERVED_CLASS_ERROR);
}

export function actionErrorFromRegistrationFailure(error: unknown): string | null {
  if (!isNoReservedClassError(error)) return null;
  const reasonMatch = error.message.match(/\(([^)]+)\)\s*$/);
  if (!reasonMatch) return registrationOutcomeMessage([]);
  const reasons = reasonMatch[1].split(",").map((part) => part.trim());
  return registrationOutcomeMessage(reasons.map((reason) => ({ success: false, reason })));
}
