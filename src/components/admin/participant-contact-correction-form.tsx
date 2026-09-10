"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  correctParticipantContact,
  type ParticipantContactActionState,
} from "@/lib/services/phase-6-actions";

type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  display_phone: string;
  phone_country: string;
  email: string | null;
};

export function ParticipantContactCorrectionForm({ participant }: { participant: Participant }) {
  const [state, action] = useActionState<ParticipantContactActionState, FormData>(
    correctParticipantContact,
    {},
  );

  return (
    <section
      className="mt-8 rounded border bg-white p-6"
      aria-labelledby="contact-correction-title"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        System Admin only
      </p>
      <h2 id="contact-correction-title" className="mt-1 text-xl font-semibold">
        Correct contact details
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Name, phone, and email only. Participant ID and all registration, attendance, legal,
        notification, and follow-up history stay unchanged. A matching identity is sent to review
        instead of being merged.
      </p>
      <form
        action={action}
        className="mt-5 grid gap-4 sm:grid-cols-2"
        data-testid="participant-contact-form"
      >
        <input type="hidden" name="participantId" value={participant.id} />
        <label>
          First name
          <input
            name="firstName"
            required
            defaultValue={participant.first_name}
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label>
          Last name
          <input
            name="lastName"
            required
            defaultValue={participant.last_name}
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label>
          Phone
          <input
            name="phone"
            required
            defaultValue={participant.display_phone}
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label>
          Phone country
          <input
            name="phoneCountry"
            required
            defaultValue={participant.phone_country}
            maxLength={3}
            className="mt-1 w-full rounded border p-2 uppercase"
          />
        </label>
        <label className="sm:col-span-2">
          Email
          <input
            name="email"
            type="email"
            defaultValue={participant.email ?? ""}
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label className="sm:col-span-2">
          Reason for correction
          <textarea
            name="reason"
            required
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <div className="sm:col-span-2">
          <SubmitButton>Save contact correction</SubmitButton>
        </div>
        {state.error ? (
          <p role="alert" className="sm:col-span-2 text-sm text-red-700">
            {state.error}
            {state.reviewCaseId ? ` Review case: ${state.reviewCaseId}.` : null}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="sm:col-span-2 text-sm text-emerald-700">
            {state.success}
          </p>
        ) : null}
      </form>
    </section>
  );
}
