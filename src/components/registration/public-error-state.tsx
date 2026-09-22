import Link from "next/link";

type PublicErrorStateProps = {
  code?: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  /** Calm recovery keeps the dial layout/animation without HTTP-style codes. */
  variant?: "error" | "recovery";
  eyebrow?: string;
};

export function PublicErrorState({
  code = "NOTE",
  title,
  message,
  actionLabel,
  actionHref,
  secondaryActionLabel,
  secondaryActionHref,
  variant = "error",
  eyebrow,
}: PublicErrorStateProps) {
  const recovery = variant === "recovery";
  const dialLabel = recovery ? (eyebrow ?? "Arakkis") : code;
  return (
    <main
      className={`public-error-page${recovery ? " public-error-page-recovery" : ""}`}
      aria-labelledby="public-error-title"
    >
      <div className="public-error-content">
        <div className="public-error-status">
          {!recovery && code === "404" ? (
            <>
              40<span className="public-error-status-dial">4</span>
            </>
          ) : (
            <span className="public-error-status-dial">{dialLabel}</span>
          )}
        </div>
        <div className="public-error-divider" aria-hidden="true" />
        <div className="public-error-copy">
          <h1 id="public-error-title">{title}</h1>
          <p>{message}</p>
          {actionLabel && actionHref ? (
            <Link className="public-error-action" href={actionHref}>
              {actionLabel}
              <span aria-hidden="true">↗</span>
            </Link>
          ) : null}
          {secondaryActionLabel && secondaryActionHref ? (
            <Link
              className="public-error-action public-error-action-secondary"
              href={secondaryActionHref}
            >
              {secondaryActionLabel}
              <span aria-hidden="true">↗</span>
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
