"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { CopyLinkButton } from "@/components/admin/copy-link-button";

type Action = (state: Phase3ActionState, formData: FormData) => Promise<Phase3ActionState>;

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  submitOptions,
  focusFirstError = false,
  className,
  cancelHref,
  cancelLabel = "Cancel",
  cancelAction,
  actionsClassName = "admin-action-form-buttons",
  submitClassName,
  cancelClassName = "admin-action-form-cancel",
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  submitOptions?: Array<{ label: string; value: string }>;
  focusFirstError?: boolean;
  className?: string;
  cancelHref?: string;
  cancelLabel?: string;
  cancelAction?: () => void;
  actionsClassName?: string;
  submitClassName?: string;
  cancelClassName?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const submittedValues = useRef(new Map<string, string>());
  useEffect(() => {
    if (!state.error || !formRef.current) return;
    for (const control of formRef.current.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("[name]")) {
      if (control instanceof HTMLInputElement && control.type === "file") continue;
      const value = submittedValues.current.get(control.name);
      if (value !== undefined) control.value = value;
    }
    if (focusFirstError) {
      window.requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>(":invalid")?.focus();
      });
    }
    formRef.current.dispatchEvent(
      new CustomEvent("arakkis:form-error", {
        bubbles: true,
        detail: { form: formRef.current, message: state.error },
      }),
    );
  }, [focusFirstError, state.error]);
  return (
    <form
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
        </div>
      ) : cancelHref || cancelAction ? (
        <div className={actionsClassName}>
          <SubmitButton className={submitClassName}>{submitLabel}</SubmitButton>
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
      ) : (
        <SubmitButton>{submitLabel}</SubmitButton>
      )}
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
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
        </p>
      ) : null}
    </form>
  );
}
