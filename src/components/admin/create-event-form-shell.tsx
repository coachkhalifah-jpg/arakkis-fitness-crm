"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import {
  PublishConfirmationModal,
  type PublishConfirmationSummary,
} from "@/components/admin/PublishConfirmationModal";
import { ErrorSummary, type FieldError } from "@/components/admin/ErrorSummary";
import { useDraftRecovery } from "@/hooks/use-draft-recovery";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { features } from "@/lib/features";

type Action = (state: Phase3ActionState, formData: FormData) => Promise<Phase3ActionState>;

type DraftFields = Record<string, string>;

function readTextFields(form: HTMLFormElement): DraftFields {
  const data = new FormData(form);
  const next: DraftFields = {};
  for (const [key, value] of data.entries()) {
    if (typeof value === "string" && key !== "creationRequestId" && key !== "eventImage") {
      next[key] = value;
    }
  }
  return next;
}

function buildPublishSummary(form: HTMLFormElement): PublishConfirmationSummary {
  const data = new FormData(form);
  const orgSelect = form.querySelector<HTMLSelectElement>('select[name="hostOrganizationId"]');
  const venueSelect = form.querySelector<HTMLSelectElement>('select[name="venueId"]');
  const orgOption = orgSelect?.selectedOptions[0];
  const venueOption = venueSelect?.selectedOptions[0];
  const access = String(data.get("accessMode") ?? "PUBLIC");
  const accessLabel =
    access === "UNLISTED"
      ? "Unlisted (direct link)"
      : access === "INVITE_ONLY"
        ? "Invite-only"
        : "Public listing";
  const recurring = data.get("recurring") === "on";
  const startLocal = String(data.get("startLocal") ?? "");
  const endLocal = String(data.get("endLocal") ?? "");
  const endsOn = String(data.get("recurrenceEndsOn") ?? "");
  return {
    name: String(data.get("name") ?? ""),
    organizationName: orgOption?.textContent?.trim() || "—",
    venueName: venueOption?.textContent?.trim().split(" (")[0] || "—",
    timezone: venueOption?.textContent?.match(/\(([^)]+)\)\s*$/)?.[1] ?? "—",
    scheduleSummary: recurring
      ? `Recurring weekly through ${endsOn || "—"}`
      : `${startLocal || "—"} → ${endLocal || "—"}`,
    occurrenceCount: recurring ? undefined : 1,
    firstOccurrence: startLocal.slice(0, 10) || undefined,
    lastOccurrence: recurring ? endsOn || undefined : endLocal.slice(0, 10) || undefined,
    capacityPerClass: String(data.get("capacity") ?? "—"),
    deadlineBehavior: String(data.get("registrationDeadlineLocal") || "At/before start"),
    visibilityLabel: "Public",
    accessModeLabel: accessLabel,
    hasParticipantContent: Boolean(
      String(data.get("description") ?? "").trim() ||
        String(data.get("participantInstructions") ?? "").trim(),
    ),
    hasImage: Boolean(
      (form.querySelector<HTMLInputElement>('input[name="eventImage"]')?.files?.length ?? 0) > 0,
    ),
  };
}

/**
 * Create Event V2 form shell: unsaved warning, draft recovery, publish confirm, error summary.
 * Only mount when `adminEventsV2` is enabled.
 */
export function CreateEventFormShell({
  action,
  children,
  draftStorageKey = "arakkis:create-event-draft",
}: {
  action: Action;
  children: React.ReactNode;
  draftStorageKey?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const submittedValues = useRef(new Map<string, string>());
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<PublishConfirmationSummary | null>(null);

  const initialDraft = useMemo<DraftFields>(() => ({}), []);
  const draft = useDraftRecovery(initialDraft, {
    storageKey: draftStorageKey,
    enabled: features.eventDraftRecovery,
  });

  useUnsavedChanges(dirty && !state.success);

  useEffect(() => {
    if (!state.error || !formRef.current) return;
    for (const control of formRef.current.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("[name]")) {
      if (control instanceof HTMLInputElement && control.type === "file") continue;
      const value = submittedValues.current.get(control.name);
      if (value !== undefined) control.value = value;
    }
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>(":invalid")?.focus();
    });
    formRef.current.dispatchEvent(
      new CustomEvent("arakkis:form-error", {
        bubbles: true,
        detail: { form: formRef.current, message: state.error },
      }),
    );
  }, [state.error]);

  useEffect(() => {
    if (!state.success) return;
    draft.clearDraft();
  }, [draft, state.success]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || !draft.active || !draft.recovered) return;
    for (const [key, value] of Object.entries(draft.value)) {
      const control = form.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(`[name="${CSS.escape(key)}"]`);
      if (!control || (control instanceof HTMLInputElement && control.type === "file")) continue;
      control.value = value;
    }
  }, [draft.active, draft.recovered, draft.value]);

  const markDirty = useCallback(() => {
    setDirty(true);
    const form = formRef.current;
    if (form && draft.active) {
      draft.setValue(readTextFields(form));
    }
  }, [draft]);

  const fieldErrors: FieldError[] =
    state.fieldErrors ?? (state.error ? [{ message: state.error }] : []);

  const requestPublish = () => {
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;
    if (features.eventPublishConfirmation) {
      setSummary(buildPublishSummary(form));
      setConfirmOpen(true);
      return;
    }
    form.requestSubmit(
      form.querySelector<HTMLButtonElement>('button[name="intent"][value="publish"]') ?? undefined,
    );
  };

  const confirmPublish = () => {
    const form = formRef.current;
    if (!form) return;
    setConfirmOpen(false);
    form.requestSubmit(
      form.querySelector<HTMLButtonElement>('button[name="intent"][value="publish"]') ?? undefined,
    );
  };

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="admin-create-event-form"
        onInput={markDirty}
        onChange={markDirty}
        onSubmit={(event) => {
          submittedValues.current = new Map(
            [...new FormData(event.currentTarget).entries()].filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          );
        }}
      >
        {draft.active && draft.recovered ? (
          <p role="status" className="admin-create-guidance">
            Recovered a local draft.{" "}
            <button type="button" className="underline" onClick={() => draft.discardRecovery()}>
              Discard recovered draft
            </button>
          </p>
        ) : null}
        <ErrorSummary errors={fieldErrors} />
        {children}
        <div className="admin-create-final-actions flex flex-wrap gap-3">
          <SubmitButton name="intent" value="draft">
            Save as Draft
          </SubmitButton>
          <button type="button" className="ui-button ui-button-primary" onClick={requestPublish}>
            Review &amp; Publish
          </button>
          <button name="intent" value="publish" type="submit" className="sr-only" tabIndex={-1}>
            Publish
          </button>
        </div>
        {state.success ? (
          <p role="status" className="text-sm text-green-700">
            {state.success}
            {state.createdEventId ? (
              <>
                <span className="mt-2 block font-medium">
                  {state.createdStatus ?? "Draft"} created: {state.createdName ?? "Event"}.
                </span>
                <span className="mt-2 flex flex-wrap gap-3">
                  <Link className="underline" href={`/admin/events/${state.createdEventId}`}>
                    Open the created event
                  </Link>
                  {state.publicUrl ? (
                    <a className="underline" href={state.publicUrl}>
                      Public registration page
                    </a>
                  ) : null}
                  {state.inviteUrl ? <CopyLinkButton url={state.inviteUrl} /> : null}
                </span>
              </>
            ) : null}
          </p>
        ) : null}
      </form>
      <PublishConfirmationModal
        open={confirmOpen}
        summary={summary}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmPublish}
      />
    </>
  );
}
