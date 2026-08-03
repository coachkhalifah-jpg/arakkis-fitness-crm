"use client";

import { useState } from "react";
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
    <button type="button" className="rounded border px-3 py-1 text-sm" onClick={copy}>
      {copied ? "Copied" : "Copy"}
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
    <button type="button" className="ui-button ui-button-secondary" onClick={copy}>
      {copied ? "Copied" : "Copy Message"}
    </button>
  );
}
