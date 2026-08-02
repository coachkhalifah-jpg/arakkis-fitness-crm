"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

export function WhatToBring({
  eventId,
  instructions,
}: {
  eventId: string;
  instructions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [origin, setOrigin] = useState<{
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const close = useCallback(() => {
    if (!open || closing) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setOpen(false);
      return;
    }
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimerRef.current = null;
    }, 320);
  }, [closing, open]);

  useEffect(() => {
    if (!open || closing) return;
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [close, closing, open]);

  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !dialogRef.current || !triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const dialogRect = dialogRef.current.getBoundingClientRect();
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;
    const dialogCenterX = dialogRect.left + dialogRect.width / 2;
    const dialogCenterY = dialogRect.top + dialogRect.height / 2;

    setOrigin({
      x: triggerCenterX - dialogRect.left,
      y: triggerCenterY - dialogRect.top,
      deltaX: triggerCenterX - dialogCenterX,
      deltaY: triggerCenterY - dialogCenterY,
    });
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="confirmation-what-to-bring-trigger"
        aria-expanded={open}
        aria-controls={`what-to-bring-${eventId}`}
        onClick={() => {
          setClosing(false);
          setOrigin(null);
          setOpen(true);
        }}
      >
        <span>
          <span className="block font-semibold">What to bring</span>
          <span className="mt-1 block text-sm">{instructions.join(", ")}</span>
        </span>
        <span aria-hidden="true" className="text-xl leading-none">
          ›
        </span>
      </button>

      {open ? (
        <div
          className={`confirmation-what-to-bring-backdrop${closing ? " is-closing" : ""}`}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            ref={dialogRef}
            id={`what-to-bring-${eventId}`}
            className={`confirmation-what-to-bring-dialog${origin ? " is-ready" : ""}${closing ? " is-closing" : ""}`}
            style={
              origin
                ? ({
                    "--sheet-origin-x": `${origin.x}px`,
                    "--sheet-origin-y": `${origin.y}px`,
                    "--sheet-delta-x": `${origin.deltaX}px`,
                    "--sheet-delta-y": `${origin.deltaY}px`,
                  } as CSSProperties)
                : undefined
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby={`what-to-bring-title-${eventId}`}
          >
            <div className="confirmation-what-to-bring-header">
              <h2 id={`what-to-bring-title-${eventId}`} className="text-base font-semibold">
                What to bring
              </h2>
            </div>
            <div className="confirmation-what-to-bring-content">
              <ul className="space-y-2 leading-7">
                {instructions.map((instruction, index) => (
                  <li key={`${eventId}-expanded-instruction-${index}`}>{instruction}</li>
                ))}
              </ul>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="confirmation-what-to-bring-close"
              aria-label="Close What to bring"
              onClick={close}
            >
              ×
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
