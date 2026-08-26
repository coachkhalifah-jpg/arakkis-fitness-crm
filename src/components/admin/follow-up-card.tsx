"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { recordFollowUpCopy, recordGroupChatReminderCopy } from "@/lib/services/phase-6-actions";

type Props = { task: { id: string; suggested_message: string | null } };

export function CopyPhoneButton({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(phone);
    setCopied(true);
  }

  return (
    <button
      type="button"
      className="copy-message-button ops-community-send-message-button"
      aria-label={copied ? "Phone number copied" : "Send message by copying phone number"}
      title={copied ? "Phone number copied" : "Send message"}
      onClick={copy}
    >
      {copied ? <Check aria-hidden="true" size={18} /> : null}
      <span className="copy-message-button-label">{copied ? "COPIED" : "SEND MESSAGE"}</span>
    </button>
  );
}

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
      aria-label={copied ? "Copied" : "Copy note"}
      title={copied ? "Copied" : "Copy note"}
      onClick={copy}
    >
      {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
      <span className="copy-message-button-label">{copied ? "COPIED" : "COPY NOTE"}</span>
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
      aria-label={copied ? "Copied" : "Copy note"}
      title={copied ? "Copied" : "Copy note"}
      onClick={copy}
    >
      {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
      <span className="copy-message-button-label">{copied ? "COPIED" : "COPY NOTE"}</span>
    </button>
  );
}
