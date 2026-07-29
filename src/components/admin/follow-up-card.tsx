"use client";

import { useState } from "react";
import { recordFollowUpCopy } from "@/lib/services/phase-6-actions";

type Props = { task: { id: string; suggested_message: string | null } };

export function FollowUpCopyButton({ task }: Props) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(task.suggested_message ?? "");
    await recordFollowUpCopy(task.id);
    setCopied(true);
  }
  return (
    <button type="button" className="rounded border px-3 py-1 text-sm" onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
