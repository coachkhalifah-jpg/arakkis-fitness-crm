"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MouseEvent } from "react";

export function CommunityModeNav({ mode }: { mode: "individual" | "group" }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupHref = `${pathname}?mode=group&status=${searchParams.get("status") ?? "PENDING"}`;
  const individualHref = `${pathname}?status=${searchParams.get("status") ?? "PENDING"}`;

  function navigate(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    direction: "to-group" | "to-individual",
  ) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    document.documentElement.dataset.pageTransition = direction;
    const startViewTransition = document.startViewTransition?.bind(document);
    if (startViewTransition) {
      const transition = startViewTransition(() => router.push(href));
      void transition.finished.finally(() => {
        delete document.documentElement.dataset.pageTransition;
      });
      return;
    }
    router.push(href);
  }

  return (
    <nav className="follow-up-mode-nav mt-6" data-mode={mode} aria-label="Community queue mode">
      <span className="follow-up-mode-indicator" aria-hidden="true" />
      <Link
        href={individualHref}
        data-selected={mode === "individual"}
        onClick={(event) => navigate(event, individualHref, "to-individual")}
      >
        Touch Base
      </Link>
      <Link
        href={groupHref}
        data-selected={mode === "group"}
        onClick={(event) => navigate(event, groupHref, "to-group")}
      >
        Group Chat
      </Link>
    </nav>
  );
}
