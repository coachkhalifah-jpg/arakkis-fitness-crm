"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";

type FormErrorEvent = CustomEvent<{ form?: HTMLFormElement; message?: string }>;

export function ProgressiveDisclosureSection({
  id,
  number,
  title,
  children,
  defaultOpen = false,
  autoOpenOnField,
  errorKeywords = [],
  className,
}: {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  autoOpenOnField?: string;
  errorKeywords?: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionRef = useRef<HTMLElement>(null);
  const contentId = `${id}-content`;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const field = autoOpenOnField
      ? section.closest("form")?.querySelector<HTMLInputElement>(`[name="${autoOpenOnField}"]`)
      : null;
    const onFieldChange = () => {
      if (field instanceof HTMLInputElement && field.checked) setOpen(true);
    };
    field?.addEventListener("change", onFieldChange);
    const onFormError = (event: Event) => {
      const detail = (event as FormErrorEvent).detail;
      if (detail?.form && !section.closest("form")?.isSameNode(detail.form)) return;
      const message = (detail?.message ?? "").toLowerCase();
      if (
        !message ||
        !errorKeywords.length ||
        errorKeywords.some((keyword) => message.includes(keyword))
      ) {
        setOpen(true);
      }
    };
    document.addEventListener("arakkis:form-error", onFormError);
    return () => {
      field?.removeEventListener("change", onFieldChange);
      document.removeEventListener("arakkis:form-error", onFormError);
    };
  }, [autoOpenOnField, errorKeywords]);

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`admin-create-disclosure ${className ?? ""} ${open ? "is-open" : ""}`}
      onInvalidCapture={() => setOpen(true)}
    >
      <DisclosureToggle
        className="admin-create-disclosure-toggle"
        expanded={open}
        controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="admin-create-disclosure-number">{number}</span>
        <span>{title}</span>
      </DisclosureToggle>
      <div id={contentId} className="admin-create-disclosure-content" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
