"use client";

import { useState } from "react";

import type { EngageRecommendation } from "@/lib/services/engage-recommendations";

export function EngageRecommendationActionCard({
  recommendation,
}: {
  recommendation: EngageRecommendation;
}) {
  const [message, setMessage] = useState(recommendation.suggestedNote);
  const [draft, setDraft] = useState(recommendation.suggestedNote);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");

  async function copyNote() {
    await navigator.clipboard.writeText(message);
    setNotice("Copied");
  }

  function saveNote() {
    setMessage(draft);
    setEditing(false);
    setNotice("Saved for this view");
  }

  return (
    <article
      className="ops-community-task-detail-content"
      aria-label="Selected Engage recommendation"
    >
      <div className="ops-community-detail-kicker-row">
        <span className="ops-community-detail-kicker">
          {recommendation.category.replaceAll("_", " ")}
        </span>
        <span className="ops-community-detail-due">IDEA</span>
      </div>
      <h3 className="ops-community-detail-title">{recommendation.title}</h3>
      <div className="ops-community-detail-divider" />
      <p className="ops-community-detail-description">{recommendation.context}</p>
      <div className="ops-community-detail-divider" />
      <section
        className="ops-community-detail-message"
        aria-labelledby={`engage-note-${recommendation.id}`}
      >
        <div className="ops-community-detail-message-heading">
          <span
            id={`engage-note-${recommendation.id}`}
            className="ops-community-detail-message-label"
          >
            Suggested note
          </span>
          {editing ? (
            <button type="button" className="ops-community-detail-edit-label" onClick={saveNote}>
              SAVE
            </button>
          ) : (
            <button
              type="button"
              className="ops-community-detail-edit-label"
              onClick={() => {
                setDraft(message);
                setNotice("");
                setEditing(true);
              }}
            >
              EDIT
            </button>
          )}
        </div>
        {editing ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Edit suggested note"
            className="ops-community-detail-textarea"
          />
        ) : (
          <p className="ops-community-detail-message-preview">{message || "No suggested note."}</p>
        )}
        <button type="button" className="copy-message-button" onClick={copyNote}>
          {notice ? notice.toUpperCase() : "COPY NOTE"}
        </button>
      </section>
      <p className="ops-community-detail-description">
        {recommendation.cta}. This idea is not saved until you choose to use it.
      </p>
    </article>
  );
}
