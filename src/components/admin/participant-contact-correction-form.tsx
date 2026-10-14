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
    <section className="people-profile-panel" aria-labelledby="contact-correction-title">
      <p className="people-profile-panel-kicker">System Admin only</p>
      <h2 id="contact-correction-title">Correct contact details</h2>
      <p className="people-profile-panel-lede">
        Name, phone, and email only. Participant ID and all registration, attendance, legal,
        notification, and follow-up history stay unchanged. A matching identity is sent to review
        instead of being merged.
      </p>
      <form action={action} className="people-profile-form" data-testid="participant-contact-form">
        <input type="hidden" name="participantId" value={participant.id} />
        <label>
          First name
          <input name="firstName" required defaultValue={participant.first_name} />
        </label>
        <label>
          Last name
          <input name="lastName" required defaultValue={participant.last_name} />
        </label>
        <label>
          Phone
          <input name="phone" required defaultValue={participant.display_phone} />
        </label>
        <label>
          Phone country
          <input
            name="phoneCountry"
            required
            defaultValue={participant.phone_country}
            maxLength={3}
            className="people-profile-input-uppercase"
          />
        </label>
        <label className="people-profile-form-wide">
          Email
          <input name="email" type="email" defaultValue={participant.email ?? ""} />
        </label>
        <label className="people-profile-form-wide">
          Reason for correction
          <textarea name="reason" required maxLength={500} rows={3} />
        </label>
        <div className="people-profile-form-wide">
          <SubmitButton>Save contact correction</SubmitButton>
        </div>
        {state.error ? (
          <p role="alert" className="people-profile-form-wide people-profile-message is-error">
            {state.error}
            {state.reviewCaseId ? ` Review case: ${state.reviewCaseId}.` : null}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="people-profile-form-wide people-profile-message is-success">
            {state.success}
          </p>
        ) : null}
      </form>
    </section>
  );
}
