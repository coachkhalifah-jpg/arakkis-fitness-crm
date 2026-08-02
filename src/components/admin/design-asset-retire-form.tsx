"use client";

import { useActionState } from "react";
import {
  retireDesignAsset,
  type DesignAssetActionState,
} from "@/lib/services/design-assets-actions";

export function DesignAssetRetireForm({ id }: { id: string }) {
  const [state, action] = useActionState<DesignAssetActionState, FormData>(retireDesignAsset, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="admin-secondary-button text-admin-danger">
        Retire
      </button>
      {state.error ? (
        <p role="alert" className="mt-2 text-xs text-admin-danger">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-2 text-xs text-admin-success">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
