/**
 * Rethrow Next.js control-flow errors that must not be converted into action
 * return values (redirect / notFound). Catching them causes full-page 500s.
 */
export function rethrowNextControlFlow(error: unknown): void {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string"
  ) {
    const digest = (error as { digest: string }).digest;
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
  }
}
