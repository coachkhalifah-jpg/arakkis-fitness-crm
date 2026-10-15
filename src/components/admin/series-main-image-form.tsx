"use client";

import { useActionState } from "react";
import {
  issueSeriesImageIntent,
  replaceSeriesMainImage,
  type DesignAssetActionState,
} from "@/lib/services/design-assets-actions";
import { SubmitButton } from "@/components/admin/submit-button";

const initialState: DesignAssetActionState = {};

export function SeriesMainImageForm({
  seriesId,
  intentToken,
  defaultAltText = "Series event image",
}: {
  seriesId: string;
  intentToken?: string;
  defaultAltText?: string;
}) {
  const uploadWithFreshIntent = async (
    previous: DesignAssetActionState,
    formData: FormData,
  ): Promise<DesignAssetActionState> => {
    const freshIntent = await issueSeriesImageIntent(seriesId);
    if (!freshIntent) {
      return {
        error: "This series image form is invalid or expired. Refresh the Event and try again.",
      };
    }
    formData.set("seriesImageIntent", freshIntent);
    formData.set("seriesId", seriesId);
    return replaceSeriesMainImage(previous, formData);
  };

  const [state, action] = useActionState(uploadWithFreshIntent, initialState);

  return (
    <form
      action={action}
      className="admin-event-image-upload-form admin-series-main-image-form grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="seriesId" value={seriesId} />
      <input type="hidden" name="seriesImageIntent" value={intentToken ?? ""} />
      <label className="design-assets-field">
        Focal position
        <select name="focalPosition" defaultValue="center" className="design-assets-control">
          <option value="top">Top</option>
          <option value="center">Center</option>
          <option value="bottom">Bottom</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
      <label className="design-assets-field sm:col-span-2">
        Alt text
        <input
          name="altText"
          required
          maxLength={240}
          defaultValue={defaultAltText}
          placeholder="Describe the image for participants"
          className="design-assets-control"
        />
      </label>
      <label className="design-assets-field sm:col-span-2">
        Image file
        <input
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="design-assets-file-control"
        />
        <span className="design-assets-help">
          JPEG, PNG, WebP, or SVG · 5 MiB maximum · updates future non-cancelled dates
        </span>
      </label>
      <div className="sm:col-span-2">
        <SubmitButton className="design-assets-primary-button">
          UPDATE SERIES IMAGE{" "}
          <span className="arakkis-arrow-icon" aria-hidden="true">
            ↗
          </span>
        </SubmitButton>
      </div>
      {state.error ? (
        <p role="alert" className="design-assets-form-message design-assets-form-error">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="design-assets-form-message design-assets-form-success">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
