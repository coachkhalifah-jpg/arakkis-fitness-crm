"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { recordFollowUpCopy, recordGroupChatReminderCopy } from "@/lib/services/phase-6-actions";

type Props = { task: { id: string; suggested_message: string | null } };

export function FollowUpCopyButton({ task }: Props) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(task.suggested_message ?? "");
    await recordFollowUpCopy(task.id);
    setCopied(true);
  }
  return (
    <button
      type="button"
      className="copy-message-button"
      aria-label={copied ? "Copied" : "Copy message"}
      title={copied ? "Copied" : "Copy message"}
      onClick={copy}
    >
      {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
      <span className="sr-only">{copied ? "Copied" : "Copy message"}</span>
    </button>
  );
}

export function GroupChatCopyButton({
  reminder,
}: {
  reminder: { id: string; suggested_message: string };
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(reminder.suggested_message);
    await recordGroupChatReminderCopy(reminder.id);
    setCopied(true);
  }
  return (
    <button
      type="button"
      className="copy-message-button"
      aria-label={copied ? "Copied" : "Copy message"}
      title={copied ? "Copied" : "Copy message"}
      onClick={copy}
    >
      {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
      <span className="sr-only">{copied ? "Copied" : "Copy message"}</span>
    </button>
  );
}
