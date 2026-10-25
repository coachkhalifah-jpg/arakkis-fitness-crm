"use client";

import { useEffect, useState } from "react";
import { ActionFormSuccessCheckmark } from "@/components/admin/action-form-success-checkmark";

/** Inline confirmation hold before dismiss (readable, not snackbar-length). */
export const BESIDE_SUCCESS_HOLD_MS = 2000;
/** Short fade-out after hold; keep below remount-key churn. */
export const BESIDE_SUCCESS_FADE_OUT_MS = 200;

/** Ephemeral beside-submit success (Manage Event update): lime check + short label, then clear. */
export function ActionFormBesideSuccess({
  successNonce,
  label,
  className,
  holdMs = BESIDE_SUCCESS_HOLD_MS,
  fadeOutMs = BESIDE_SUCCESS_FADE_OUT_MS,
}: {
  successNonce: number | string;
  label: string;
  className?: string;
  holdMs?: number;
  fadeOutMs?: number;
}) {
  // Fresh mount (parent keys on successNonce) starts visible; timeout only hides.
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    // Fresh mount (parent keys on successNonce) starts in "in"; effect only schedules hide.
    const holdTimer = window.setTimeout(() => setPhase("out"), holdMs);
    return () => window.clearTimeout(holdTimer);
  }, [holdMs, successNonce]);

  useEffect(() => {
    if (phase !== "out") return;
    const fadeTimer = window.setTimeout(() => setPhase("gone"), fadeOutMs);
    return () => window.clearTimeout(fadeTimer);
  }, [fadeOutMs, phase]);

  if (phase === "gone") return null;

  const classes = [className, phase === "out" ? "is-fading-out" : null].filter(Boolean).join(" ");

  return (
    <p role="status" className={classes} data-testid="action-form-beside-success">
      <ActionFormSuccessCheckmark className="action-form-success-checkmark" />
      <span className="action-form-success-checkmark__message">{label}</span>
    </p>
  );
}
