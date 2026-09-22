import Link from "next/link";

type PublicErrorStateProps = {
  code?: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  /** Calm recovery surfaces avoid HTTP-style dials (404 / EXPIRED / NO LINK). */
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
  return (
    <main
      className={`public-error-page${recovery ? " public-error-page-recovery" : ""}`}
      aria-labelledby="public-error-title"
    >
      <div className="public-error-content">
        {recovery ? (
          <p className="public-error-eyebrow">{eyebrow ?? "Arakkis"}</p>
        ) : (
          <div className="public-error-status">
            {code === "404" ? (
              <>
                40<span className="public-error-status-dial">4</span>
              </>
            ) : (
              <span className="public-error-status-dial">{code}</span>
            )}
          </div>
        )}
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
