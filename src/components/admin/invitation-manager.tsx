"use client";

import { useState, useTransition } from "react";
import { createHostInvitation, regenerateInvitation, revokeInvitation } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

type Invitation = {
  id: string;
  invited_email: string;
  role: string;
  status: string;
  token_expires_at: string;
  issued_at: string;
  accepted_at: string | null;
  organizationNames: string[];
};

export function InvitationManager({
  organizations,
  invitations,
  mode = "list",
}: {
  organizations: Array<{ id: string; name: string }>;
  invitations: Invitation[];
  mode?: "list" | "invite";
}) {
  const [message, setMessage] = useState<{ kind: "status" | "error"; text: string } | null>(null);
  const [oneTimeUrl, setOneTimeUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (
    operation: () => Promise<{ error?: string; success?: string; inviteUrl?: string }>,
  ) =>
    startTransition(async () => {
      const result = await operation();
      if (result.inviteUrl) setOneTimeUrl(result.inviteUrl);
      setMessage(
        result.error
          ? { kind: "error", text: result.error }
          : {
              kind: "status",
              text:
                result.success ??
                "Invitation created. Copy the link now; it will not be shown again.",
            },
      );
    });
  return (
    <>
      {mode === "invite" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            run(() => createHostInvitation(form));
          }}
          className="admin-surface mt-8 grid gap-3 rounded-3xl p-6 sm:grid-cols-2"
        >
          <h2 className="sm:col-span-2 text-lg font-semibold">Create Host Admin invitation</h2>
          <label>
            Email
            <input name="email" type="email" required className="mt-1 w-full rounded border p-2" />
          </label>
          <label>
            Organization
            <select name="organizationIds" required className="mt-1 w-full rounded border p-2">
              <option value="">Select organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <p className="sm:col-span-2 text-sm text-slate-600">
            Invitations expire after 72 hours. No email is sent automatically.
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create invitation"}
          </Button>
        </form>
      ) : null}
      {oneTimeUrl ? (
        <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4" role="status">
          <p className="font-medium">
            Copy this invitation link now. It will not be displayed after leaving this page.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              aria-label="New invitation link"
              readOnly
              value={oneTimeUrl}
              className="min-w-0 flex-1 rounded border p-2 text-sm"
            />
            <Button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(oneTimeUrl);
                setMessage({ kind: "status", text: "Invitation link copied." });
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
            message.kind === "error" ? "mt-4 text-sm text-red-700" : "mt-4 text-sm text-green-700"
          }
          role={message.kind}
        >
          {message.text}
        </p>
      ) : null}
      {mode === "list" ? (
        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Invitation history</h2>
          {invitations.map((invitation) => (
            <article key={invitation.id} className="admin-surface rounded-3xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{invitation.invited_email}</h3>
                  <p className="text-sm text-slate-600">
                    {invitation.role} ·{" "}
                    {invitation.organizationNames.join(", ") || "No active assignment"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {invitation.status} · expires{" "}
                    {new Date(invitation.token_expires_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {invitation.status === "PENDING" ? (
                    <>
                      <Button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => regenerateInvitation(invitation.id))}
                      >
                        Regenerate
                      </Button>
                      <Button
                        type="button"
                        disabled={pending}
                        variant="destructive"
                        onClick={() => run(() => revokeInvitation(invitation.id))}
                      >
                        Revoke
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
