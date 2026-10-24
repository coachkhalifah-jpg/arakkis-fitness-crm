"use client";

import { useEffect, useState } from "react";
import { ActionFormSuccessCheckmark } from "@/components/admin/action-form-success-checkmark";

const DEFAULT_HOLD_MS = 1000;

/** Ephemeral beside-submit success (Manage Event update): lime check + short label, ~1s then clear. */
export function ActionFormBesideSuccess({
  successNonce,
  label,
  className,
  holdMs = DEFAULT_HOLD_MS,
}: {
  successNonce: number | string;
  label: string;
  className?: string;
  holdMs?: number;
}) {
  // Fresh mount (parent keys on successNonce) starts visible; timeout only hides.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), holdMs);
    return () => window.clearTimeout(timer);
  }, [holdMs, successNonce]);

  if (!visible) return null;

  return (
    <p role="status" className={className} data-testid="action-form-beside-success">
      <ActionFormSuccessCheckmark className="action-form-success-checkmark" />
      <span className="action-form-success-checkmark__message">{label}</span>
    </p>
  );
}
