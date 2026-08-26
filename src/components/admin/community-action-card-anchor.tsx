"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function CommunityActionCardAnchor() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectionKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const actionCard = document.getElementById("selected-touchpoint");
      if (!actionCard) return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      actionCard.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectionKey]);

  return null;
}
