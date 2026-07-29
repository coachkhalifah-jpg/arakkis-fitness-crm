"use client";

import { useState } from "react";

export function CopyLinkButton({ url }: { url: string }) {
  const [message, setMessage] = useState("");
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage("Registration link copied.");
          } catch {
            setMessage("Copy was unavailable. Select the link manually.");
          }
        }}
      >
        Copy registration link
      </button>
      <span role="status" aria-live="polite" className="text-sm text-slate-600">
        {message}
      </span>
    </span>
  );
}
