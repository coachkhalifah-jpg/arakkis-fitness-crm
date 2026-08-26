"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { TimeTextInput } from "@/components/admin/time-text-input";

type ScheduleRow = { weekday: string; start: string; end: string };

const weekdays = [
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
  ["7", "Sunday"],
] as const;

function dateWeekday(value: string) {
  if (!value) return "1";
  return String(new Date(`${value}T00:00:00Z`).getUTCDay() || 7);
}

function collectRows(rows: ScheduleRow[]) {
  const errors: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    if (!row.weekday || !row.start || !row.end) errors.push(`Complete schedule row ${index + 1}.`);
    if (row.start && row.end && row.end <= row.start)
      errors.push(`Schedule row ${index + 1}: end time must be after start time.`);
    const key = `${row.weekday}:${row.start}:${row.end}`;
    if (seen.has(key)) errors.push(`Schedule row ${index + 1} duplicates another row.`);
    seen.add(key);
  });
  for (let left = 0; left < rows.length; left += 1) {
    for (let right = left + 1; right < rows.length; right += 1) {
      if (
        rows[left].weekday === rows[right].weekday &&
        rows[left].start < rows[right].end &&
        rows[right].start < rows[left].end
      ) {
        errors.push(`Schedule row ${right + 1} overlaps schedule row ${left + 1}.`);
      }
    }
  }
  return [...new Set(errors)];
}

function countOccurrences(rows: ScheduleRow[], startDate: string, endDate: string) {
  if (!startDate || !endDate) return { count: 0, error: "Choose a series end date." };
  if (endDate < startDate)
    return { count: 0, error: "The series end date must be on or after the first Event date." };
  let count = 0;
  for (let value = startDate; value <= endDate; value = nextDate(value)) {
    const weekday = dateWeekday(value);
    count += rows.filter((row) => row.weekday === weekday).length;
    if (count > 104)
      return { count, error: "A recurring Event may contain at most 104 generated dates." };
  }
  return { count, error: null };
}

function focusScheduleError(form: HTMLFormElement | null, errors: string[]) {
  const selector = errors.some((error) => error.toLowerCase().includes("series end date"))
    ? 'input[name="recurrenceEndsOn"]'
    : 'select[name="scheduleRuleWeekday"], input[name="scheduleRuleStartTime"], input[name="scheduleRuleEndTime"]';
  window.setTimeout(() => form?.querySelector<HTMLElement>(selector)?.focus(), 0);
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function RecurringScheduleFields() {
  const [rows, setRows] = useState<ScheduleRow[]>([{ weekday: "1", start: "", end: "" }]);
  const [errors, setErrors] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const recurrenceEndTouched = useRef(false);

  useEffect(() => {
    const recurring = document.querySelector<HTMLInputElement>('input[name="recurring"]');
    const start = document.querySelector<HTMLInputElement>('input[name="startLocal"]');
    const end = document.querySelector<HTMLInputElement>('input[name="endLocal"]');
    const recurrenceEnd = document.querySelector<HTMLInputElement>(
      'input[name="recurrenceEndsOn"]',
    );
    const syncEnabled = () => setEnabled(Boolean(recurring?.checked));
    const syncFirstRow = (event?: Event) => {
      const detail =
        event instanceof CustomEvent ? (event.detail as { start?: string; end?: string }) : null;
      const startValue = detail?.start ?? start?.value ?? "";
      const endValue = detail?.end ?? end?.value ?? "";
      const defaultEndDate = endValue.slice(0, 10) || startValue.slice(0, 10);
      if (recurrenceEnd && defaultEndDate && !recurrenceEndTouched.current)
        recurrenceEnd.value = defaultEndDate;
      if (!startValue) return;
      setRows((current) =>
        current.map((row, index) =>
          index
            ? row
            : {
                weekday: dateWeekday(startValue.slice(0, 10)),
                start: startValue.slice(11, 16) || row.start,
                end: endValue.slice(11, 16) || row.end,
              },
        ),
      );
    };
    syncFirstRow();
    syncEnabled();
    const markRecurrenceEndTouched = () => {
      recurrenceEndTouched.current = true;
    };
    recurring?.addEventListener("change", syncEnabled);
    start?.addEventListener("input", syncFirstRow);
    end?.addEventListener("input", syncFirstRow);
    recurrenceEnd?.addEventListener("input", markRecurrenceEndTouched);
    window.addEventListener("arakkis:schedule-time-change", syncFirstRow);
    return () => {
      start?.removeEventListener("input", syncFirstRow);
      end?.removeEventListener("input", syncFirstRow);
      recurrenceEnd?.removeEventListener("input", markRecurrenceEndTouched);
      recurring?.removeEventListener("change", syncEnabled);
      window.removeEventListener("arakkis:schedule-time-change", syncFirstRow);
    };
  }, []);

  useEffect(() => {
    const endDate = document.querySelector<HTMLInputElement>('input[name="recurrenceEndsOn"]');
    if (!endDate) return;
    endDate.required = enabled;
    endDate.setAttribute("aria-required", String(enabled));
    return () => {
      endDate.required = false;
      endDate.removeAttribute("aria-required");
    };
  }, [enabled]);

  const update = (index: number, key: keyof ScheduleRow, value: string) => {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    );
    setErrors([]);
  };

  const validateSubmit = (event: FormEvent<HTMLFieldSetElement>) => {
    if (!enabled) return;
    const rowErrors = collectRows(rows);
    const form = event.currentTarget.closest("form");
    const startDate =
      form?.querySelector<HTMLInputElement>('input[name="startLocal"]')?.value.slice(0, 10) ?? "";
    const endDate =
      form?.querySelector<HTMLInputElement>('input[name="recurrenceEndsOn"]')?.value ?? "";
    const occurrenceResult = countOccurrences(rows, startDate, endDate);
    const nextErrors = [...rowErrors, ...(occurrenceResult.error ? [occurrenceResult.error] : [])];
    if (!nextErrors.length) return;
    event.preventDefault();
    setErrors([...new Set(nextErrors)]);
    focusScheduleError(form, nextErrors);
  };

  useEffect(() => {
    if (!enabled) return;
    const form = document.querySelector<HTMLFormElement>("form.admin-create-event-form");
    if (!form) return;
    const onSubmit = (event: Event) => {
      const rowErrors = collectRows(rows);
      const startDate =
        form.querySelector<HTMLInputElement>('input[name="startLocal"]')?.value.slice(0, 10) ?? "";
      const endDate =
        form.querySelector<HTMLInputElement>('input[name="recurrenceEndsOn"]')?.value ?? "";
      const occurrenceResult = countOccurrences(rows, startDate, endDate);
      const nextErrors = [
        ...rowErrors,
        ...(occurrenceResult.error ? [occurrenceResult.error] : []),
      ];
      if (!nextErrors.length) return;
      event.preventDefault();
      setErrors([...new Set(nextErrors)]);
      focusScheduleError(form, nextErrors);
    };
    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, [enabled, rows]);

  return (
    <fieldset className="admin-recurring-schedule-fields" onSubmitCapture={validateSubmit}>
      <legend>Schedule</legend>
      <p className="admin-create-guidance">
        Add each weekday and local time that belongs to this one recurring Event series.
      </p>
      <div className="admin-recurring-schedule-list" aria-disabled={!enabled}>
        {rows.map((row, index) => (
          <div className="admin-recurring-schedule-row" key={index}>
            <label>
              <span>Weekday {index + 1}</span>
              <select
                name="scheduleRuleWeekday"
                value={row.weekday}
                disabled={!enabled}
                aria-label={`Schedule row ${index + 1} weekday`}
                onChange={(event) => update(index, "weekday", event.currentTarget.value)}
                required={enabled}
              >
                {weekdays.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Start time {index + 1}</span>
              <TimeTextInput
                name="scheduleRuleStartTime"
                value={row.start}
                disabled={!enabled}
                aria-label={`Schedule row ${index + 1} start time`}
                onChange={(value) => update(index, "start", value)}
                required={enabled}
              />
            </label>
            <label>
              <span>End time {index + 1}</span>
              <TimeTextInput
                name="scheduleRuleEndTime"
                value={row.end}
                disabled={!enabled}
                aria-label={`Schedule row ${index + 1} end time`}
                onChange={(value) => update(index, "end", value)}
                required={enabled}
              />
            </label>
            {index > 0 ? (
              <button
                type="button"
                className="admin-recurring-schedule-remove"
                disabled={!enabled}
                aria-label={`Remove schedule row ${index + 1}`}
                onClick={() => {
                  setErrors([]);
                  setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="admin-recurring-schedule-add"
        disabled={!enabled}
        onClick={() =>
          setRows((current) => {
            const first = current[0] ?? { weekday: "1", start: "", end: "" };
            return [...current, { weekday: first.weekday, start: first.start, end: first.end }];
          })
        }
      >
        + Add day &amp; time
      </button>
      {errors.length ? (
        <div className="admin-create-field-error" role="alert">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
