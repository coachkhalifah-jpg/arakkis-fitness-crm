import Link from "next/link";
import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  href,
  action,
  variant,
}: {
  title?: string;
  description: string;
  href?: string;
  action?: string;
  variant?: "default" | "public-events";
}) {
  if (variant === "public-events") {
    return (
      <Card className="empty-state-card empty-state-public-events">
        <p className="empty-state-public-events-kicker">Arakkis events / no access required</p>
        <h2>
          <span>No</span>
          <span>events</span>
          <em>available</em>
          <em>yet.</em>
        </h2>
        <p className="empty-state-public-events-description">{description}</p>
        {href && action ? (
          <Link className="empty-state-public-events-action" href={href}>
            {action} <span aria-hidden="true">↗</span>
          </Link>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="empty-state-card border-dashed bg-[var(--surface-elevated)] px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-2xl text-brand">
        ✦
      </div>
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {href && action ? (
        <Link
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] hover:bg-brand-dark"
          href={href}
        >
          {action}
        </Link>
      ) : null}
    </Card>
  );
}
