"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { ActionFormBesideSuccess } from "@/components/admin/action-form-beside-success";
import { ActionFormSuccessCheckmark } from "@/components/admin/action-form-success-checkmark";

type Action = (state: Phase3ActionState, formData: FormData) => Promise<Phase3ActionState>;

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  submitOptions,
  focusFirstError = false,
  className,
  id,
  cancelHref,
  cancelLabel = "Cancel",
  cancelAction,
  actionsClassName = "admin-action-form-buttons",
  submitClassName,
  cancelClassName = "admin-action-form-cancel",
  successClassName,
  successCheckmark = false,
  successBesideSubmit = false,
  successStatusLabel = "UPDATED",
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  submitOptions?: Array<{ label: string; value: string }>;
  focusFirstError?: boolean;
  className?: string;
  id?: string;
  cancelHref?: string;
  cancelLabel?: string;
  cancelAction?: () => void;
  actionsClassName?: string;
  submitClassName?: string;
  cancelClassName?: string;
  /** Optional scoped success row class (e.g. Manage Event lime polish). */
  successClassName?: string;
  /** When true, render a one-shot animated checkmark next to the success text. */
  successCheckmark?: boolean;
  /**
   * When true, show ephemeral checkmark + successStatusLabel beside the submit
   * control (same actions row) instead of the below-form success row.
   * Opt-in; Manage Event update only today.
   */
  successBesideSubmit?: boolean;
  /** Short status label for beside-submit success (default UPDATED). */
  successStatusLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const submittedValues = useRef(new Map<string, string>());
  const successRemountKey = state.successNonce ?? state.success;
  const besideSuccess =
    successBesideSubmit && state.success && successRemountKey != null ? (
      <ActionFormBesideSuccess
        key={`beside-${successRemountKey}`}
        successNonce={successRemountKey}
        label={successStatusLabel}
        className={successClassName ?? "admin-manage-event-update-success"}
      />
    ) : null;

  useEffect(() => {
    if (!state.error || !formRef.current) return;
    const form = formRef.current;
    const owned = [
      ...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "[name]",
      ),
    ];
    const associated = id
      ? [
          ...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
            `[form="${id}"][name]`,
          ),
        ]
      : [];
    for (const control of [...owned, ...associated]) {
      if (control instanceof HTMLInputElement && control.type === "file") continue;
      const value = submittedValues.current.get(control.name);
      if (value !== undefined) control.value = value;
    }
    if (focusFirstError) {
      window.requestAnimationFrame(() => {
        const invalidOwned = form.querySelector<HTMLElement>(":invalid");
        const invalidAssociated = id
          ? document.querySelector<HTMLElement>(`[form="${id}"]:invalid`)
          : null;
        (invalidOwned ?? invalidAssociated)?.focus();
      });
    }
    form.dispatchEvent(
      new CustomEvent("arakkis:form-error", {
        bubbles: true,
        detail: { form, message: state.error },
      }),
    );
  }, [focusFirstError, id, state.error]);
  return (
    <form
      id={id}
      ref={formRef}
      action={formAction}
      className={className ?? "grid gap-4"}
      onSubmit={(event) => {
        submittedValues.current = new Map(
          [...new FormData(event.currentTarget).entries()].filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        );
      }}
    >
      {children}
      {submitOptions?.length ? (
        <div className="admin-create-final-actions flex flex-wrap gap-3">
          {submitOptions.map((option) => (
            <SubmitButton key={option.value} name="intent" value={option.value}>
              {option.label}
            </SubmitButton>
          ))}
          {besideSuccess}
        </div>
      ) : cancelHref || cancelAction ? (
        <div className={actionsClassName}>
          <SubmitButton className={submitClassName}>{submitLabel}</SubmitButton>
          {besideSuccess}
          {cancelHref ? (
            <Link className={cancelClassName} href={cancelHref}>
              {cancelLabel}
            </Link>
          ) : (
            <button type="button" className={cancelClassName} onClick={cancelAction}>
              {cancelLabel}
            </button>
          )}
        </div>
      ) : successBesideSubmit ? (
        <div className="admin-manage-event-update-actions">
          <SubmitButton className={submitClassName}>{submitLabel}</SubmitButton>
          {besideSuccess}
        </div>
      ) : (
        <SubmitButton>{submitLabel}</SubmitButton>
      )}
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success && !successBesideSubmit ? (
        <p
          key={successCheckmark ? `success-${state.successNonce ?? state.success}` : undefined}
          role="status"
          className={successClassName ?? "text-sm text-green-700"}
        >
          {successCheckmark ? (
            <ActionFormSuccessCheckmark className="action-form-success-checkmark" />
          ) : null}
          <span className={successCheckmark ? "action-form-success-checkmark__message" : undefined}>
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
                  <Link className="underline" href="/admin/events">
                    Back to Events
                  </Link>
                </span>
              </>
            ) : null}
            {state.inviteUrl ? (
              <span className="mt-2 flex flex-wrap gap-3">
                <a className="break-all underline" href={state.inviteUrl}>
                  {state.inviteUrl}
                </a>
                <CopyLinkButton url={state.inviteUrl} />
              </span>
            ) : null}
          </span>
        </p>
      ) : null}
    </form>
  );
}
