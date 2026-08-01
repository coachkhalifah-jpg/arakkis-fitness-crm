"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function SegmentedNavigation({
  listLabel,
  actionLabel,
  actionHref,
  actionMode = "create",
}: {
  listLabel: string;
  actionLabel: string;
  actionHref: string;
  actionMode?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = searchParams.get("mode") === actionMode;
  const listHref = pathname;
  return (
    <nav className="admin-segmented-nav" aria-label={`${listLabel} workspace modes`}>
      <Link href={listHref} aria-current={!action ? "page" : undefined} data-selected={!action}>
        {listLabel}
      </Link>
      <Link href={actionHref} aria-current={action ? "page" : undefined} data-selected={action}>
        {actionLabel}
      </Link>
    </nav>
  );
}
