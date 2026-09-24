"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  issueParticipantManageRecoveryLink,
  revokeParticipantManageRecoveryLink,
} from "@/lib/services/participant-manage-recovery-actions";

type PendingLink = {
  id: string;
  expires_at: string;
  issued_at: string;
  status: string;
};

export function ParticipantManageRecoveryPanel({
  participantId,
  displayPhone,
  pendingLink,
}: {
  participantId: string;
  displayPhone: string;
  pendingLink: PendingLink | null;
}) {
  const [message, setMessage] = useState<{ kind: "status" | "error"; text: string } | null>(null);
  const [oneTimeUrl, setOneTimeUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (
    operation: () => Promise<{
      error?: string;
      success?: string;
      manageUrl?: string;
    }>,
  ) =>
    startTransition(async () => {
      const result = await operation();
      if (result.manageUrl) setOneTimeUrl(result.manageUrl);
      setMessage(
        result.error
          ? { kind: "error", text: result.error }
          : {
              kind: "status",
              text: result.success ?? "Manage link updated.",
            },
      );
    });

  return (
    <section
      className="mt-8 rounded border bg-white p-6"
      aria-labelledby="manage-recovery-title"
      data-testid="participant-manage-recovery"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        System Admin only
      </p>
      <h2 id="manage-recovery-title" className="mt-1 text-xl font-semibold">
        Manage / recovery link
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Send the participant a temporary link so they can view and manage upcoming bookings on a
        browser that is not remembered yet.
      </p>
      <p className="mt-3 text-sm">
        <span className="text-slate-500">Text or WhatsApp to:</span>{" "}
        <strong data-testid="manage-recovery-phone">{displayPhone}</strong>
      </p>

      {pendingLink ? (
        <p className="mt-3 text-sm text-slate-600" data-testid="manage-recovery-pending">
          Active link pending · expires {new Date(pendingLink.expires_at).toLocaleString()} · issued{" "}
          {new Date(pendingLink.issued_at).toLocaleString()}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No active manage link.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          data-testid="manage-recovery-generate"
          onClick={() => run(() => issueParticipantManageRecoveryLink(participantId))}
        >
          {pendingLink ? "Regenerate link" : "Generate manage link"}
        </Button>
        {pendingLink ? (
          <Button
            type="button"
            disabled={pending}
            variant="secondary"
            data-testid="manage-recovery-revoke"
            onClick={() => run(() => revokeParticipantManageRecoveryLink(participantId))}
          >
            Revoke
          </Button>
        ) : null}
      </div>

      {oneTimeUrl ? (
        <div
          className="ops-invitation-result mt-4"
          role="status"
          data-testid="manage-recovery-result"
        >
          <p>
            No message is sent automatically. Text or WhatsApp this link to the participant’s phone.
            Copy now; it won’t be shown again.
          </p>
          <div>
            <input aria-label="New manage recovery link" readOnly value={oneTimeUrl} />
            <Button
              type="button"
              data-testid="manage-recovery-copy"
              onClick={() => {
                void navigator.clipboard.writeText(oneTimeUrl);
                setMessage({ kind: "status", text: "Manage link copied." });
              }}
            >
              Copy link
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p
          className={
            message.kind === "error" ? "ops-invitation-message is-error" : "ops-invitation-message"
          }
          role={message.kind}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
