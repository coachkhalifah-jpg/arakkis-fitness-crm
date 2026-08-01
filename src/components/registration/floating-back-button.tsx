"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function FloatingBackButton({ href = "/events" }: { href?: string }) {
  const sentinel = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span ref={sentinel} className="absolute top-0 h-px w-px" aria-hidden="true" />
      <Link
        href={href}
        aria-label="Back to events"
        tabIndex={visible || focused ? 0 : -1}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`floating-back-button ${!visible && !focused ? "floating-back-button-hidden" : ""}`}
      >
        <ArrowLeft size={21} aria-hidden="true" />
      </Link>
    </>
  );
}
