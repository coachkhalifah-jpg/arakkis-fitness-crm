"use client";

import { useEffect } from "react";
import { features } from "@/lib/features";

export type UnsavedChangesOptions = {
  /** When false, the warning is disabled even if adminEventsV2 is on. */
  enabled?: boolean;
  message?: string;
};

/**
 * Warns before leaving when the Create Event form is dirty.
 * Inactive unless `adminEventsV2` is enabled.
 */
export function useUnsavedChanges(isDirty: boolean, options: UnsavedChangesOptions = {}) {
  const active = features.adminEventsV2 && (options.enabled ?? true);
  const message =
    options.message ?? "You have unsaved Event changes. Leave this page and discard them?";

  useEffect(() => {
    if (!active || !isDirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active, isDirty, message]);

  return { active };
}
