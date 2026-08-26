"use client";

import { useState } from "react";

export function CopyBookingLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="confirmation-calendar-link confirmation-calendar-link-secondary"
        onClick={copy}
      >
        {copied ? "Copied" : "Copy booking link"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Booking link copied" : ""}
      </span>
    </>
  );
}
