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
        Copy address
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Directions copied" : ""}
      </span>
    </div>
  );
}
