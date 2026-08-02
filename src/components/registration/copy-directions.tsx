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
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        className="confirmation-inline-action"
        onClick={copy}
        aria-label="Copy directions"
      >
        Copy directions
      </button>
      <span className="text-sm text-[var(--confirmation-muted)]" role="status" aria-live="polite">
        {copied ? "Copied" : null}
      </span>
    </div>
  );
}
