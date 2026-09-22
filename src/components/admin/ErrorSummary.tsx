"use client";

import { useEffect, useId, useRef } from "react";
import { features } from "@/lib/features";

export type FieldError = {
  field?: string;
  message: string;
};

type ErrorSummaryProps = {
  errors: FieldError[];
  title?: string;
  className?: string;
  autoFocus?: boolean;
};

/**
 * Structured Create Event error summary with optional focus management.
 * Renders nothing unless `adminEventsV2` is enabled or there are no errors.
 */
export function ErrorSummary({
  errors,
  title = "Fix the following before continuing",
  className,
  autoFocus = true,
}: ErrorSummaryProps) {
  const headingId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!features.adminEventsV2 || !autoFocus || errors.length === 0) return;
    containerRef.current?.focus();
  }, [autoFocus, errors]);

  if (!features.adminEventsV2 || errors.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={
        className ??
        "rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm"
      }
      role="alert"
      tabIndex={-1}
      aria-labelledby={headingId}
    >
      <p id={headingId} className="font-medium">
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((error, index) => (
          <li key={`${error.field ?? "form"}-${index}`}>
            {error.field ? (
              <a
                href={`#${error.field}`}
                className="underline"
                onClick={(event) => {
                  const target = document.getElementById(error.field!);
                  if (!target) return;
                  event.preventDefault();
                  target.focus?.();
                  target.scrollIntoView({ block: "center", behavior: "smooth" });
                }}
              >
                {error.message}
              </a>
            ) : (
              error.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
