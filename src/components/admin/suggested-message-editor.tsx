"use client";

import type { ReactNode } from "react";

type Props = {
  id: string;
  initialMessage: string;
  recordName: string;
  recordValue: string;
  saveAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
};

export function SuggestedMessageEditor({
  id,
  initialMessage,
  recordName,
  recordValue,
  saveAction,
  children,
}: Props) {
  return (
    <section className="ops-community-detail-message">
      <details className="ops-community-detail-edit">
        <summary
          className="ops-community-detail-message-heading"
          onClick={(event) => {
            const details = event.currentTarget.parentElement;
            if (details?.tagName === "DETAILS" && details.hasAttribute("open")) {
              event.preventDefault();
              (document.getElementById(`${id}-form`) as HTMLFormElement | null)?.requestSubmit();
            }
          }}
        >
          <span className="ops-community-detail-message-label">Suggested note</span>
          <span className="ops-community-detail-edit-label">EDIT</span>
          <span className="ops-community-detail-save-label">SAVE</span>
        </summary>
        <div className="ops-community-detail-edit-panel">
          <form
            id={`${id}-form`}
            action={saveAction}
            onSubmit={(event) => {
              const details = event.currentTarget.closest("details");
              if (details) details.open = false;
            }}
          >
            <textarea
              id={id}
              name="suggestedMessage"
              defaultValue={initialMessage}
              aria-label="Suggested note"
              className="ops-community-detail-textarea"
            />
            <input type="hidden" name={recordName} value={recordValue} />
          </form>
        </div>
      </details>
      <p className="ops-community-detail-message-preview">
        {initialMessage || "No suggested note."}
      </p>
      {children}
    </section>
  );
}
