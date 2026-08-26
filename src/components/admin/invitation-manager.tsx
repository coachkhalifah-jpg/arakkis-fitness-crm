"use client";

import { useState, useTransition } from "react";
import { createHostInvitation, regenerateInvitation, revokeInvitation } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { ProgressiveDisclosureSection } from "@/components/admin/progressive-disclosure-section";

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

const statusGroups = [
  { key: "PENDING", label: "Pending", tone: "pending" },
  { key: "EXPIRED", label: "Expired", tone: "expired" },
  { key: "REVOKED", label: "Revoked", tone: "revoked" },
  { key: "ACCEPTED", label: "Accepted", tone: "accepted" },
  { key: "REPLACED", label: "Replaced", tone: "replaced" },
] as const;

function invitationRole(role: string) {
  return role.replaceAll("_", " ");
}

function recordLabel(count: number) {
  return `${count} ${count === 1 ? "record" : "records"}`;
}

function invitationSummary(count: number, status: string) {
  return `${count} ${status.toLowerCase()} invitation${count === 1 ? "" : "s"}`;
}

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
          className="ops-invitation-form"
        >
          <p className="ops-kicker orange">New invitation</p>
          <h2>Configure access.</h2>
          <p className="ops-invitation-form-intro">
            Host Admin access is scoped to one Organization.
          </p>
          <div className="ops-invitation-form-rule" />
          <label>
            Recipient email
            <input name="email" type="email" required placeholder="host@example.com" />
          </label>
          <label>
            Role
            <input value="Host Admin" readOnly aria-readonly="true" />
          </label>
          <label>
            Organization scope
            <select name="organizationIds" required>
              <option value="">Select organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Expiration
            <input value="72 hours" readOnly aria-readonly="true" />
          </label>
          <div className="ops-invitation-form-rule" />
          <p className="ops-invitation-form-note">
            Invitations expire after 72 hours. No email is sent automatically.
          </p>
          <Button type="submit" disabled={pending} className="ops-invitation-submit">
            {pending ? (
              "Creating…"
            ) : (
              <>
                Send invitation <span aria-hidden="true">↗</span>
              </>
            )}
          </Button>
        </form>
      ) : null}
      {oneTimeUrl ? (
        <div className="ops-invitation-result" role="status">
          <p>Copy this invitation link now. It will not be displayed after leaving this page.</p>
          <div>
            <input aria-label="New invitation link" readOnly value={oneTimeUrl} />
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
            message.kind === "error" ? "ops-invitation-message is-error" : "ops-invitation-message"
          }
          role={message.kind}
        >
          {message.text}
        </p>
      ) : null}
      {mode === "list" ? (
        <div className="ops-invitation-history">
          <div className="ops-invitation-history-head">
            <h2>Invitation history</h2>
            <span>
              {recordLabel(invitations.length)} ·{" "}
              {invitations.filter((item) => item.status === "PENDING").length} active
            </span>
          </div>
          <div className="admin-create-event-page ops-invitation-accordion-shell">
            {statusGroups.map((group, index) => {
              const groupInvitations = invitations.filter(
                (invitation) => invitation.status === group.key,
              );
              if (!groupInvitations.length) return null;
              return (
                <ProgressiveDisclosureSection
                  className={`ops-invitation-group is-${group.tone}`}
                  id={`invitation-status-${group.key.toLowerCase()}`}
                  number={String(index + 1).padStart(2, "0")}
                  title={`${group.label} · ${recordLabel(groupInvitations.length)}`}
                  defaultOpen={false}
                  key={group.key}
                >
                  {groupInvitations.map((invitation) => (
                    <article key={invitation.id} className="ops-invitation-record">
                      <p className="ops-invitation-record-role">
                        {invitationRole(invitation.role)}
                      </p>
                      <h4>{invitation.invited_email}</h4>
                      <p className="ops-invitation-record-organization">
                        {invitation.organizationNames.join(", ") || "No active assignment"}
                      </p>
                      <p className="ops-invitation-record-status">{group.label}</p>
                      <p className="ops-invitation-record-meta">
                        Expires {new Date(invitation.token_expires_at).toLocaleString()}
                        <br />
                        Issued {new Date(invitation.issued_at).toLocaleString()}
                      </p>
                      {invitation.status === "PENDING" ? (
                        <div className="ops-invitation-record-actions">
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
                        </div>
                      ) : null}
                    </article>
                  ))}
                </ProgressiveDisclosureSection>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
