"use client";

import { useState } from "react";

export function CopyDirections({ directions }: { directions: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(directions);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="confirmation-copy-directions">
      <button
        type="button"
        className="confirmation-copy-directions-button"
        onClick={copy}
        aria-label="Copy directions"
        title="Copy directions"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 9.5A2.5 2.5 0 0 1 11.5 7H17a2.5 2.5 0 0 1 2.5 2.5V15a2.5 2.5 0 0 1-2.5 2.5h-5.5A2.5 2.5 0 0 1 9 15V9.5Z" />
          <path d="M15 7V6.5A2.5 2.5 0 0 0 12.5 4H7A2.5 2.5 0 0 0 4.5 6.5V12A2.5 2.5 0 0 0 7 14.5h2" />
        </svg>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Directions copied" : ""}
      </span>
    </div>
  );
}
