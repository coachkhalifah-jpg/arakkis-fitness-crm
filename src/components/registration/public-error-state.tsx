import Link from "next/link";

type PublicErrorStateProps = {
  code: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

export function PublicErrorState({
  code,
  title,
  message,
  actionLabel,
  actionHref,
}: PublicErrorStateProps) {
  return (
    <main className="public-error-page" aria-labelledby="public-error-title">
      <div className="public-error-content">
        <div className="public-error-status">
          {code === "404" ? (
            <>
              40<span className="public-error-status-dial">4</span>
            </>
          ) : (
            <span className="public-error-status-dial">{code}</span>
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
        </div>
      </div>
    </main>
  );
}
