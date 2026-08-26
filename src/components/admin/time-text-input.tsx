"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

function displayTime(value: string, format: "12" | "24") {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  if (format === "24") return `${match[1]}:${match[2]}`;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${match[2]} ${suffix}`;
}

function parseTime(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
  const twelveHour = /^(\d{1,2})(?::(\d{2}))? ?(AM|PM)$/.exec(normalized);
  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2] ?? "00");
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const convertedHour = (hour % 12) + (twelveHour[3] === "PM" ? 12 : 0);
    return `${String(convertedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const twentyFourHour = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (!twentyFourHour) return null;
  const hour = Number(twentyFourHour[1]);
  const minute = Number(twentyFourHour[2]);
  return hour <= 23 && minute <= 59
    ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    : null;
}

export function TimeTextInput({
  value,
  onChange,
  name,
  format = "12",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  format?: "12" | "24";
}) {
  const [draft, setDraft] = useState(() => displayTime(value, format));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(displayTime(value, format));
  }, [format, value]);

  return (
    <>
      <input
        {...props}
        type="text"
        inputMode="text"
        autoComplete="off"
        placeholder={format === "24" ? "HH:MM" : "h:mm AM"}
        maxLength={format === "24" ? 5 : 8}
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => {
          focused.current = false;
          const parsed = parseTime(draft);
          if (parsed) {
            onChange(parsed);
            setDraft(displayTime(parsed, format));
          } else {
            setDraft(displayTime(value, format));
          }
        }}
      />
      <input type="hidden" name={name} value={value} />
    </>
  );
}
