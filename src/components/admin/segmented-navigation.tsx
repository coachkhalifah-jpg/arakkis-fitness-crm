"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function SegmentedNavigation({
  listLabel,
  actionLabel,
  actionHref,
  actionMode = "create",
  listMeta,
  actionIcon,
  className = "",
}: {
  listLabel: string;
  actionLabel: string;
  actionHref: string;
  actionMode?: string;
  listMeta?: string;
  actionIcon?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = searchParams.get("mode") === actionMode;
  const listHref = pathname;
  return (
    <nav
      className={`admin-segmented-nav ${className}`.trim()}
      data-mode={action ? "action" : "list"}
      aria-label={`${listLabel} workspace modes`}
    >
      <span className="admin-segmented-indicator" aria-hidden="true" />
      <Link href={listHref} aria-current={!action ? "page" : undefined} data-selected={!action}>
        <span>{listLabel}</span>
        {listMeta ? <span className="admin-segmented-meta">{listMeta}</span> : null}
      </Link>
      <Link href={actionHref} aria-current={action ? "page" : undefined} data-selected={action}>
        <span>{actionLabel}</span>
        {actionIcon ? (
          <span className="admin-segmented-icon" aria-hidden="true">
            {actionIcon}
          </span>
        ) : null}
      </Link>
    </nav>
  );
}
