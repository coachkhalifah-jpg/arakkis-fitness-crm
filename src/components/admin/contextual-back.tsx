"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ContextualBack({
  href = "/admin",
  label = "Operational Workspace",
}: {
  href?: string;
  label?: string;
}) {
  const [compact, setCompact] = useState(false);
  const [focused, setFocused] = useState(false);
  const sentinel = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), {
      threshold: 0,
    });
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <span ref={sentinel} className="absolute top-0 h-px w-px" aria-hidden="true" />
      <Link
        href={href}
        aria-label={`Back to ${label}`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`admin-contextual-back ${compact && !focused ? "admin-contextual-back-hidden" : ""}`}
      >
        <ArrowLeft aria-hidden="true" size={17} /> <span>{label}</span>
      </Link>
    </>
  );
}
