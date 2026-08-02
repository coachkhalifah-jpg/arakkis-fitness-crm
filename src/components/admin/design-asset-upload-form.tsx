"use client";

import { useActionState } from "react";
import {
  uploadDesignAsset,
  type DesignAssetActionState,
} from "@/lib/services/design-assets-actions";
import { SubmitButton } from "@/components/admin/submit-button";

const initialState: DesignAssetActionState = {};

export function DesignAssetUploadForm({ events }: { events: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState(uploadDesignAsset, initialState);
  return (
    <form
      action={action}
      className="grid gap-4 rounded-3xl border border-admin-border bg-admin-surface-muted p-5 sm:grid-cols-2"
    >
      <label>
        Asset type
        <select
          name="assetType"
          defaultValue="PUBLIC_BACKGROUND_DESKTOP"
          className="mt-1 w-full rounded-xl border border-admin-border bg-white p-3"
        >
          <option value="PUBLIC_BACKGROUND_DESKTOP">Public background · desktop</option>
          <option value="PUBLIC_BACKGROUND_MOBILE">Public background · mobile</option>
          <option value="EVENT_IMAGE_DESKTOP">Event image · desktop</option>
          <option value="EVENT_IMAGE_MOBILE">Event image · mobile</option>
          <option value="CATEGORY_IMAGE">Category fallback</option>
        </select>
      </label>
      <label>
        Event (event image only)
        <select
          name="eventId"
          defaultValue=""
          className="mt-1 w-full rounded-xl border border-admin-border bg-white p-3"
        >
          <option value="">Not event-specific</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Category (category fallback only)
        <select
          name="categoryKey"
          defaultValue=""
          className="mt-1 w-full rounded-xl border border-admin-border bg-white p-3"
        >
          <option value="">Choose a category</option>
          <option value="boxing">Boxing</option>
          <option value="strength">Strength</option>
          <option value="yoga">Yoga</option>
          <option value="community-fitness">Community fitness</option>
          <option value="default">Default</option>
        </select>
      </label>
      <label>
        Focal position
        <select
          name="focalPosition"
          defaultValue="center"
          className="mt-1 w-full rounded-xl border border-admin-border bg-white p-3"
        >
          <option value="top">Top</option>
          <option value="center">Center</option>
          <option value="bottom">Bottom</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
      <label className="sm:col-span-2">
        Alt text
        <input
          name="altText"
          required
          maxLength={240}
          placeholder="Describe the image for participants"
          className="mt-1 w-full rounded-xl border border-admin-border bg-white p-3"
        />
      </label>
      <label className="sm:col-span-2">
        Image file
        <input
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="mt-1 block w-full rounded-xl border border-dashed border-admin-border bg-white p-3"
        />
        <span className="mt-1 block text-xs text-admin-text-muted">
          JPEG, PNG, WebP, or SVG · 5 MiB maximum
        </span>
      </label>
      <div className="sm:col-span-2">
        <SubmitButton>Upload and activate</SubmitButton>
      </div>
      {state.error ? (
        <p role="alert" className="sm:col-span-2 text-sm text-admin-danger">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="sm:col-span-2 text-sm text-admin-success">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
