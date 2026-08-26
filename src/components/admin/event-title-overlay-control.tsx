"use client";

import { useState } from "react";

export function EventTitleOverlayControl({
  eventName,
  imageUrl,
  initialColor,
}: {
  eventName: string;
  imageUrl?: string;
  initialColor: string;
}) {
  const [color, setColor] = useState(initialColor);
  return (
    <div>
      <label>
        Event title color
        <input
          name="eventTitleColor"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="mt-1 h-11 w-full rounded border p-1"
          aria-describedby="event-title-color-help"
        />
      </label>
      <span id="event-title-color-help" className="mt-1 block text-xs text-admin-text-muted">
        Preview the title over the current Event Card image before saving.
      </span>
      <div
        className="relative mt-3 flex min-h-40 items-end overflow-hidden rounded-xl bg-cover bg-center p-5"
        style={{
          backgroundImage: imageUrl
            ? `linear-gradient(135deg, rgba(22,34,30,.14), rgba(22,34,30,.48)), url(${imageUrl})`
            : "linear-gradient(135deg, #174c68, #2e8f88 55%, #d7a779)",
        }}
        role="img"
        aria-label="Live Event Card title preview"
      >
        <span
          className="max-w-[74%] text-3xl font-extrabold leading-[0.98] tracking-[-0.02em]"
          style={{ color }}
        >
          {eventName}
        </span>
      </div>
    </div>
  );
}
