"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/admin/submit-button";
import { ProgressiveDisclosureSection } from "@/components/admin/progressive-disclosure-section";
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
      className="admin-resource-panel ops-venue-edit-panel"
      aria-labelledby="contact-correction-title"
    >
      <p className="ops-kicker orange">System Admin only</p>
      <h2 id="contact-correction-title">Correct contact details</h2>
      <p className="ops-people-profile-copy">
        Name, phone, and email only. Participant ID and all registration, attendance, legal,
        notification, and follow-up history stay unchanged. A matching identity is sent to review
        instead of being merged.
      </p>
      <form
        action={action}
        className="admin-create-event-form admin-resource-form"
        data-testid="participant-contact-form"
      >
        <input type="hidden" name="participantId" value={participant.id} />
        <ProgressiveDisclosureSection
          id="participant-contact-identity"
          number="01"
          title="Contact identity"
          defaultOpen
          errorKeywords={["name", "phone", "email", "contact"]}
        >
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
          <label>
            Email
            <input
              name="email"
              type="email"
              defaultValue={participant.email ?? ""}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
        </ProgressiveDisclosureSection>
        <ProgressiveDisclosureSection
          id="participant-contact-reason"
          number="02"
          title="Reason for correction"
          defaultOpen
          errorKeywords={["reason"]}
        >
          <label>
            Reason for correction
            <textarea
              name="reason"
              required
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
        </ProgressiveDisclosureSection>
        <div className="admin-action-form-buttons">
          <SubmitButton>Save contact correction</SubmitButton>
        </div>
        {state.error ? (
          <p role="alert" className="ops-people-profile-message is-error">
            {state.error}
            {state.reviewCaseId ? ` Review case: ${state.reviewCaseId}.` : null}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="ops-people-profile-message is-success">
            {state.success}
          </p>
        ) : null}
      </form>
    </section>
  );
}
