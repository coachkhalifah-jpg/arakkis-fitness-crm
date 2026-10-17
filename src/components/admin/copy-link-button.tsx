"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function CopyLinkButton({
  url,
  label = "Copy Link",
  className,
  showCopyIcon = false,
}: {
  url: string;
  label?: string;
  className?: string;
  showCopyIcon?: boolean;
}) {
  const [message, setMessage] = useState("");
  return (
    <span
      className={
        className ? "admin-manage-event-copy-link" : "inline-flex flex-wrap items-center gap-2"
      }
    >
      <button
        type="button"
        className={className ?? "rounded-md border border-slate-300 px-3 py-2 text-sm"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage("Registration link copied.");
          } catch {
            setMessage("Copy was unavailable. Select the link manually.");
          }
        }}
      >
        {label}
        {showCopyIcon ? <Copy aria-hidden="true" size={14} strokeWidth={2.5} /> : null}
      </button>
      <span role="status" aria-live="polite" className="text-sm text-slate-600">
        {message}
      </span>
    </span>
  );
}
