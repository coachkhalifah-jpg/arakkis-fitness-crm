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
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), holdMs);
    return () => window.clearTimeout(timer);
  }, [successNonce, holdMs]);

  if (!visible) return null;

  return (
    <p
      key={`success-${successNonce}`}
      role="status"
      className={className}
      data-testid="action-form-beside-success"
    >
      <ActionFormSuccessCheckmark className="action-form-success-checkmark" />
      <span className="action-form-success-checkmark__message">{label}</span>
    </p>
  );
}
