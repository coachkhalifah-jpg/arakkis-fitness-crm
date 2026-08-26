"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addScheduleRule,
  changeScheduleRule,
  extendSeriesEndDate,
  stopScheduleRule,
} from "@/lib/services/recurrence-actions";
import { TimeTextInput } from "@/components/admin/time-text-input";

type Rule = {
  id: string;
  weekday: number;
  local_start_time: string;
  local_end_time: string;
  effective_start_date: string;
  effective_end_date: string | null;
  supersedes_rule_id: string | null;
};

type Occurrence = {
  id: string;
  starts_at: string;
  generated_local_date: string | null;
  schedule_rule_id: string | null;
  active_bookings: number;
};

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function time(value: string) {
  return value.slice(0, 5);
}

function displayTime(value: string) {
  const [rawHour, minutes] = time(value).split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour) || minutes === undefined) return time(value);
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

function weekdayForLocalDate(value: string) {
  return Number(new Date(`${value}T00:00:00Z`).getUTCDay()) || 7;
}

function displayRule(rule: Rule) {
  return `${weekdays[rule.weekday - 1] ?? "Day"} · ${displayTime(rule.local_start_time)}–${displayTime(rule.local_end_time)}`;
}

function nextDateForWeekday(weekday: number, localTime: string, timezone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const currentWeekday =
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
      parts.find((part) => part.type === "weekday")?.value ?? "",
    ) + 1;
  const currentTime = `${parts.find((part) => part.type === "hour")?.value ?? "00"}:${parts.find((part) => part.type === "minute")?.value ?? "00"}`;
  let days = (weekday - currentWeekday + 7) % 7;
  if (days === 0 && localTime <= currentTime) days = 7;
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function RecurrenceScheduleManager({
  seriesId,
  seriesEndsOn,
  timezone,
  rules,
  occurrences,
  canMutate,
  initialWeekday = 1,
  initialStart = "19:00",
  initialEnd = "20:00",
  initialEffectiveDate = "",
}: {
  seriesId: string;
  seriesEndsOn: string;
  timezone: string;
  rules: Rule[];
  occurrences: Occurrence[];
  canMutate: boolean;
  initialWeekday?: number;
  initialStart?: string;
  initialEnd?: string;
  initialEffectiveDate?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const requestIds = useRef(new Map<string, string>());
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [changeRuleId, setChangeRuleId] = useState<string | null>(null);
  const [stopRuleId, setStopRuleId] = useState<string | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [addWeekday, setAddWeekday] = useState(String(initialWeekday));
  const [addStart, setAddStart] = useState(initialStart);
  const [addEnd, setAddEnd] = useState(initialEnd);
  const [addEffectiveDate, setAddEffectiveDate] = useState(initialEffectiveDate);
  const [changeWeekday, setChangeWeekday] = useState("1");
  const [changeStart, setChangeStart] = useState("19:00");
  const [changeEnd, setChangeEnd] = useState("20:00");
  const [changeEffectiveDate, setChangeEffectiveDate] = useState("");
  const [stopDate, setStopDate] = useState("");
  const [extendDate, setExtendDate] = useState(seriesEndsOn);
  const addDefaultsTouched = useRef(false);

  useEffect(() => {
    const syncDefaults = (event: Event) => {
      if (addDefaultsTouched.current || !(event instanceof CustomEvent)) return;
      const detail = event.detail as { start?: string; end?: string };
      const start = detail.start ?? "";
      const end = detail.end ?? "";
      if (!start || !end) return;
      setAddWeekday(String(weekdayForLocalDate(start.slice(0, 10))));
      setAddStart(start.slice(11, 16));
      setAddEnd(end.slice(11, 16));
      setAddEffectiveDate(start.slice(0, 10));
    };
    window.addEventListener("arakkis:schedule-time-change", syncDefaults);
    return () => window.removeEventListener("arakkis:schedule-time-change", syncDefaults);
  }, []);

  const occurrenceByRule = useMemo(() => {
    const grouped = new Map<string, Occurrence[]>();
    for (const occurrence of occurrences) {
      if (!occurrence.schedule_rule_id) continue;
      grouped.set(occurrence.schedule_rule_id, [
        ...(grouped.get(occurrence.schedule_rule_id) ?? []),
        occurrence,
      ]);
    }
    return grouped;
  }, [occurrences]);

  // Manage Series is a provenance view as well as an editor. Keep historical
  // rules visible so stopped and superseded schedule changes remain inspectable.
  const displayedRules = useMemo(() => rules, [rules]);

  const submit = (
    key: string,
    operation: (requestId: string) => Promise<{
      data?: {
        occurrence_count?: number;
        effective_end_date?: string;
        previous_rule_id?: string;
        series_extended?: boolean;
      };
      error?: string;
    }>,
  ) => {
    setMessage(null);
    const requestId = requestIds.current.get(key) ?? crypto.randomUUID();
    requestIds.current.set(key, requestId);
    startTransition(async () => {
      const result = await operation(requestId);
      if (result.error) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setMessage({
        kind: "success",
        text: result.data?.series_extended
          ? `Series extended. ${result.data?.occurrence_count ?? 0} new occurrence(s) generated.`
          : `Schedule updated. ${result.data?.occurrence_count ?? 0} new occurrence(s) generated.`,
      });
      setAddOpen(false);
      setChangeRuleId(null);
      setStopRuleId(null);
      setExtendOpen(false);
      requestIds.current.delete(key);
      router.refresh();
    });
  };

  const closePanel = () => {
    setAddOpen(false);
    setChangeRuleId(null);
    setStopRuleId(null);
    setExtendOpen(false);
  };

  const nextAvailableWeekday = () =>
    weekdays.findIndex((_, index) => {
      const weekday = index + 1;
      return !rules.some(
        (rule) =>
          rule.weekday === weekday &&
          rule.effective_start_date <= seriesEndsOn &&
          (rule.effective_end_date === null || rule.effective_end_date >= seriesEndsOn),
      );
    }) + 1;

  const nextAddOccurrence = nextDateForWeekday(Number(addWeekday), addStart, timezone);
  const addScheduleConstraintMessage =
    nextAddOccurrence > seriesEndsOn
      ? `This series ends on ${formatDate(seriesEndsOn)}. Extend the series end date before adding a ${weekdays[Number(addWeekday) - 1] ?? "new"} schedule; its next occurrence would be ${formatDate(nextAddOccurrence)}.`
      : null;

  return (
    <section className="admin-manage-event-series" aria-labelledby="manage-event-series-heading">
      <div className="admin-manage-event-series-heading">
        <div>
          <h2 id="manage-event-series-heading">Manage series schedule</h2>
        </div>
      </div>
      <div className="admin-series-rules" role="list">
        {displayedRules.map((rule) => {
          const ruleOccurrences = occurrenceByRule.get(rule.id) ?? [];
          const booked = ruleOccurrences.filter((occurrence) => occurrence.active_bookings > 0);
          const stopped = Boolean(
            rule.effective_end_date && rule.effective_end_date < seriesEndsOn,
          );
          const successor = rules.find((candidate) => candidate.supersedes_rule_id === rule.id);
          return (
            <div className="admin-series-rule" role="listitem" key={rule.id}>
              <div className="admin-series-rule-copy">
                <strong>{displayRule(rule)}</strong>
                <span>
                  Effective {rule.effective_start_date}
                  {rule.effective_end_date
                    ? ` through ${rule.effective_end_date}`
                    : ` through ${seriesEndsOn}`}
                  {stopped ? " · Stopped" : ""}
                </span>
                {rule.supersedes_rule_id ? <span>Successor of a previous schedule</span> : null}
                {successor ? (
                  <span>Successor effective {successor.effective_start_date}</span>
                ) : null}
                {booked.length ? (
                  <span className="admin-series-booked-warning">
                    {booked.length} booked date(s) remain unchanged:{" "}
                    {booked
                      .slice(0, 3)
                      .map((item) => item.generated_local_date ?? item.starts_at.slice(0, 10))
                      .join(", ")}
                  </span>
                ) : null}
              </div>
              {canMutate && !stopped ? (
                <div className="admin-series-rule-actions">
                  <button
                    type="button"
                    className="admin-series-action admin-series-change-trigger"
                    onClick={() => {
                      setAddOpen(false);
                      setStopRuleId(null);
                      setExtendOpen(false);
                      setChangeRuleId((current) => (current === rule.id ? null : rule.id));
                      setChangeWeekday(String(rule.weekday));
                      setChangeStart(time(rule.local_start_time));
                      setChangeEnd(time(rule.local_end_time));
                      setChangeEffectiveDate("");
                    }}
                    aria-expanded={changeRuleId === rule.id}
                  >
                    Change <span aria-hidden="true">{changeRuleId === rule.id ? "×" : "+"}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-series-action admin-series-action-subordinate"
                    onClick={() => {
                      setAddOpen(false);
                      setChangeRuleId(null);
                      setExtendOpen(false);
                      setStopRuleId((current) => (current === rule.id ? null : rule.id));
                      const today = new Date().toISOString().slice(0, 10);
                      setStopDate(
                        today < rule.effective_start_date
                          ? rule.effective_start_date
                          : today > seriesEndsOn
                            ? seriesEndsOn
                            : today,
                      );
                    }}
                    aria-expanded={stopRuleId === rule.id}
                  >
                    Stop
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {canMutate ? (
        <div className="admin-series-boundary-actions">
          <button
            type="button"
            className="admin-recurring-schedule-add admin-series-add-trigger"
            onClick={() => {
              setChangeRuleId(null);
              setStopRuleId(null);
              setExtendOpen(false);
              setAddOpen((value) => !value);
              const availableWeekday = nextAvailableWeekday();
              if (availableWeekday > 0) setAddWeekday(String(availableWeekday));
              const today = new Date().toISOString().slice(0, 10);
              if (!addEffectiveDate || addEffectiveDate < today || addEffectiveDate > seriesEndsOn)
                setAddEffectiveDate(
                  nextDateForWeekday(
                    availableWeekday > 0 ? availableWeekday : Number(addWeekday),
                    addStart,
                    timezone,
                  ),
                );
            }}
            aria-expanded={addOpen}
          >
            Add day &amp; time <span aria-hidden="true">{addOpen ? "×" : "+"}</span>
          </button>
          <button
            type="button"
            className="admin-recurring-schedule-add admin-series-extend-trigger"
            onClick={() => {
              setAddOpen(false);
              setChangeRuleId(null);
              setStopRuleId(null);
              setExtendOpen((value) => !value);
            }}
            aria-expanded={extendOpen}
          >
            Extend series <span aria-hidden="true">{extendOpen ? "×" : "+"}</span>
          </button>
        </div>
      ) : null}
      {addOpen || changeRuleId || stopRuleId || extendOpen ? (
        <div className="admin-events-page admin-manage-event-series-shell">
          <div
            className="admin-events-filter-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-series-panel-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closePanel();
            }}
          >
            <div className="admin-events-filter-sheet admin-manage-event-series-sheet">
              <div className="admin-events-filter-sheet-top">
                <div>
                  <p className="admin-events-filter-kicker">Series schedule</p>
                  <h2 id="manage-series-panel-title">
                    {addOpen
                      ? "Add day & time."
                      : changeRuleId
                        ? "Change schedule."
                        : stopRuleId
                          ? "Stop schedule."
                          : "Extend series."}
                  </h2>
                </div>
                <button
                  type="button"
                  className="admin-events-filter-close"
                  onClick={closePanel}
                  aria-label="Close series schedule menu"
                >
                  ×
                </button>
              </div>
              <div className="admin-events-filter-form admin-series-panel-form">
                {addOpen ? (
                  <>
                    <p>Add a new schedule prospectively. Venue timezone remains {timezone}.</p>
                    {addScheduleConstraintMessage ? (
                      <p className="admin-series-constraint-message" role="alert">
                        {addScheduleConstraintMessage}
                      </p>
                    ) : null}
                    <label>
                      Weekday
                      <select
                        value={addWeekday}
                        onChange={(event) => {
                          addDefaultsTouched.current = true;
                          setAddWeekday(event.currentTarget.value);
                          setAddEffectiveDate(
                            nextDateForWeekday(
                              Number(event.currentTarget.value),
                              addStart,
                              timezone,
                            ),
                          );
                        }}
                      >
                        {weekdays.map((day, index) => (
                          <option value={String(index + 1)} key={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Start time
                      <TimeTextInput
                        value={addStart}
                        onChange={(value) => {
                          addDefaultsTouched.current = true;
                          setAddStart(value);
                        }}
                        required
                      />
                    </label>
                    <label>
                      End time
                      <TimeTextInput
                        value={addEnd}
                        onChange={(value) => {
                          addDefaultsTouched.current = true;
                          setAddEnd(value);
                        }}
                        required
                      />
                    </label>
                    <label>
                      Effective date
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        max={seriesEndsOn}
                        value={addEffectiveDate}
                        onChange={(event) => {
                          addDefaultsTouched.current = true;
                          setAddEffectiveDate(event.currentTarget.value);
                        }}
                        required
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-series-submit"
                      disabled={isPending}
                      onClick={() =>
                        submit("add", (requestId) =>
                          addScheduleRule({
                            requestId,
                            seriesId,
                            weekday: Number(addWeekday),
                            localStartTime: addStart,
                            localEndTime: addEnd,
                            effectiveStartDate: addEffectiveDate || undefined,
                          }),
                        )
                      }
                    >
                      Add schedule
                    </button>
                  </>
                ) : changeRuleId ? (
                  <>
                    <p>
                      Future generation only. The current rule and all existing occurrences are
                      preserved.
                    </p>
                    <label>
                      Weekday
                      <select
                        value={changeWeekday}
                        onChange={(event) => setChangeWeekday(event.currentTarget.value)}
                      >
                        {weekdays.map((day, index) => (
                          <option value={String(index + 1)} key={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Start time
                      <TimeTextInput value={changeStart} onChange={setChangeStart} required />
                    </label>
                    <label>
                      End time
                      <TimeTextInput value={changeEnd} onChange={setChangeEnd} required />
                    </label>
                    <label>
                      Effective date
                      <input
                        type="date"
                        min={rules.find((rule) => rule.id === changeRuleId)?.effective_start_date}
                        max={seriesEndsOn}
                        value={changeEffectiveDate}
                        onChange={(event) => setChangeEffectiveDate(event.currentTarget.value)}
                        required
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-series-submit admin-series-save-change"
                      disabled={isPending}
                      onClick={() =>
                        submit(`change:${changeRuleId}`, (requestId) =>
                          changeScheduleRule({
                            requestId,
                            seriesId,
                            ruleId: changeRuleId,
                            weekday: Number(changeWeekday),
                            localStartTime: changeStart,
                            localEndTime: changeEnd,
                            effectiveStartDate: changeEffectiveDate,
                          }),
                        )
                      }
                    >
                      <span className="admin-series-save-change-default">Save</span>
                      <span className="admin-series-save-change-hover" aria-hidden="true">
                        SAVE
                      </span>
                    </button>
                  </>
                ) : extendOpen ? (
                  <>
                    <p>
                      Extend the series boundary. Existing dates, bookings, and attendance remain
                      unchanged.
                    </p>
                    <label>
                      New series end date
                      <input
                        type="date"
                        min={seriesEndsOn}
                        value={extendDate}
                        onChange={(event) => setExtendDate(event.currentTarget.value)}
                        required
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-series-submit"
                      disabled={isPending}
                      onClick={() => {
                        if (!extendDate || extendDate <= seriesEndsOn) {
                          setMessage({
                            kind: "error",
                            text: "Choose a new series end date after the current end date.",
                          });
                          return;
                        }
                        submit("extend", (requestId) =>
                          extendSeriesEndDate({ requestId, seriesId, newEndsOn: extendDate }),
                        );
                      }}
                    >
                      Extend series
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      No new dates will be generated after this date. Existing dates are not deleted
                      or cancelled.
                    </p>
                    <label>
                      Effective end date
                      <input
                        type="date"
                        min={rules.find((rule) => rule.id === stopRuleId)?.effective_start_date}
                        max={seriesEndsOn}
                        value={stopDate}
                        onChange={(event) => setStopDate(event.currentTarget.value)}
                        required
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-series-submit admin-series-stop-submit"
                      disabled={isPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Stop this schedule prospectively? Existing occurrences will remain unchanged.",
                          )
                        )
                          return;
                        submit(`stop:${stopRuleId}`, (requestId) =>
                          stopScheduleRule({
                            requestId,
                            ruleId: stopRuleId as string,
                            effectiveEndDate: stopDate,
                          }),
                        );
                      }}
                    >
                      Stop schedule
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`admin-series-message ${message.kind}`}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
