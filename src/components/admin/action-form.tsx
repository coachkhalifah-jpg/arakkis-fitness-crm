"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";
import { SubmitButton } from "@/components/admin/submit-button";

type Action = (state: Phase3ActionState, formData: FormData) => Promise<Phase3ActionState>;

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  submitOptions,
  className,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  submitOptions?: Array<{ label: string; value: string }>;
  className?: string;
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
  }, [state.error]);
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
        <div className="flex flex-wrap gap-3">
          {submitOptions.map((option) => (
            <SubmitButton key={option.value} name="intent" value={option.value}>
              {option.label}
            </SubmitButton>
          ))}
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
        </p>
      ) : null}
    </form>
  );
}
