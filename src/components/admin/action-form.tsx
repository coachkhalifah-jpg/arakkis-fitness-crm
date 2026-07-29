"use client";

import { useActionState } from "react";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";
import { SubmitButton } from "@/components/admin/submit-button";

type Action = (state: Phase3ActionState, formData: FormData) => Promise<Phase3ActionState>;

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-4">
      {children}
      <SubmitButton>{submitLabel}</SubmitButton>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-green-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
