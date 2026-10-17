"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { setPhase7SlugAction, type Phase7ActionState } from "@/lib/services/phase-7-actions";

export function EventPublicSharePanel({
  eventId,
  publicUrl,
  canonicalSlug,
  accessMode,
  suggestedSlug,
}: {
  eventId: string;
  publicUrl: string | null;
  canonicalSlug: string | null;
  accessMode: string;
  suggestedSlug: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState<Phase7ActionState, FormData>(setPhase7SlugAction, {});
  const inviteOnly = accessMode === "INVITE_ONLY";

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <div className="admin-manage-event-share-panel" data-testid="event-public-share-panel">
      <div className="admin-manage-event-calendar-share-actions">
        {publicUrl && !inviteOnly ? (
          <a className="admin-manage-event-share-link" href={publicUrl}>
            Share event <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        {canonicalSlug ? (
          <a className="admin-manage-event-share-link" href={`/admin/events/${eventId}/qr`}>
            QR Code <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        {publicUrl && !inviteOnly ? <CopyLinkButton url={publicUrl} /> : null}
      </div>

      {!canonicalSlug ? (
        <div className="admin-manage-event-share-empty" role="status">
          <p>
            No public registration link yet. Save a public slug below to generate Share and QR.
            Setting access to Public alone does not create a link.
          </p>
        </div>
      ) : null}

      {inviteOnly && canonicalSlug ? (
        <p className="admin-manage-event-share-empty">
          This Event is invite-only. Use a reusable invite link under Publication and links; the
          open Share link stays hidden.
        </p>
      ) : null}

      {publicUrl && !inviteOnly ? (
        <p className="admin-manage-event-url" data-testid="canonical-url">
          {publicUrl}
        </p>
      ) : null}

      <form action={action} className="admin-manage-event-slug-form">
        <input type="hidden" name="eventId" value={eventId} />
        <label className="admin-manage-event-slug-label" htmlFor="publicSlugShare">
          Public slug
        </label>
        <input
          id="publicSlugShare"
          name="publicSlug"
          required
          maxLength={80}
          defaultValue={canonicalSlug ?? suggestedSlug}
          placeholder="the-fight-within"
          aria-label="Public slug"
          className="min-w-0 flex-1 rounded border p-2"
        />
        <button type="submit" className="ui-button">
          Save slug
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="admin-manage-event-share-message is-error">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="admin-manage-event-share-message is-success">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
