"use client";

export function WhatToBring({
  eventId,
  instructions,
}: {
  eventId: string;
  instructions: string[];
}) {
  return (
    <article
      className="confirmation-what-to-bring-card confirmation-info-card"
      aria-labelledby={`what-to-bring-${eventId}`}
    >
      <div className="confirmation-info-card-icon" aria-hidden="true">
        ✓
      </div>
      <h2 id={`what-to-bring-${eventId}`} className="confirmation-section-title text-center">
        What to Bring
      </h2>
      <ul className="confirmation-info-card-list confirmation-body mt-4">
        {instructions.map((instruction, index) => (
          <li key={`${eventId}-instruction-${index}`}>{instruction}</li>
        ))}
      </ul>
    </article>
  );
}
