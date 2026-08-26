"use client";

import { forwardRef, useEffect, useRef, useState, type SelectHTMLAttributes } from "react";

type Organization = { id: string; name: string };
export type Venue = { id: string; name: string; organization_id: string | null; timezone: string };

export function OrganizationVenueFields({
  organizations,
  venues,
  organizationId = "",
  venueId = "",
}: {
  organizations: Organization[];
  venues: Venue[];
  organizationId?: string;
  venueId?: string;
}) {
  const [selectedOrganization, setSelectedOrganization] = useState(organizationId);
  const venueRef = useRef<HTMLSelectElement>(null);
  const organization = organizations.find((item) => item.id === selectedOrganization);

  return (
    <>
      <label>
        Organization
        <select
          name="hostOrganizationId"
          required
          defaultValue={organizationId}
          className="mt-1 w-full rounded border p-2"
          onChange={(event) => {
            const next = event.currentTarget.value;
            setSelectedOrganization(next);
            if (
              venueRef.current &&
              !venues.some(
                (venue) =>
                  venue.id === venueRef.current?.value &&
                  (venue.organization_id === next || venue.organization_id === null),
              )
            ) {
              venueRef.current.value = "";
            }
          }}
        >
          <option value="">Select organization</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Venue
        <VenueSelect
          ref={venueRef}
          name="venueId"
          required
          defaultValue={venueId}
          className="mt-1 w-full rounded border p-2"
          organizationId={selectedOrganization}
          organizationName={organization?.name}
          venues={venues}
        />
        {selectedOrganization &&
        !venues.some(
          (venue) =>
            venue.organization_id === selectedOrganization || venue.organization_id === null,
        ) ? (
          <span className="mt-1 block text-xs text-slate-600">
            No active venues are available. Create one in Venue management.
          </span>
        ) : null}
      </label>
    </>
  );
}

export const VenueSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & {
    venues: Venue[];
    organizationId: string;
    organizationName?: string;
  }
>(function VenueSelect({ venues, organizationId, organizationName, ...props }, ref) {
  const organizationVenues = venues.filter((venue) => venue.organization_id === organizationId);
  const publicVenues = venues.filter((venue) => venue.organization_id === null);
  return (
    <select {...props} ref={ref}>
      <option value="">
        {organizationVenues.length || publicVenues.length
          ? "Select venue"
          : "No active venues available"}
      </option>
      {organizationVenues.length ? (
        <optgroup label={`Organization Venues${organizationName ? ` — ${organizationName}` : ""}`}>
          {organizationVenues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name} ({venue.timezone})
            </option>
          ))}
        </optgroup>
      ) : null}
      {publicVenues.length ? (
        <optgroup label="Public Venues">
          {publicVenues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name} ({venue.timezone})
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
});

function addMinutes(value: string, minutes: number) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function splitLocal(value: string) {
  return { date: value.slice(0, 10), time: value.slice(11, 16) };
}

export function EventTimingFields({
  startValue = "",
  endValue = "",
  deadlineValue = "",
  venueTimezones = {},
}: {
  startValue?: string;
  endValue?: string;
  deadlineValue?: string;
  venueTimezones?: Record<string, string>;
}) {
  const initialStart = splitLocal(startValue);
  const initialEnd = splitLocal(endValue || startValue);
  const [eventDate, setEventDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endDate, setEndDate] = useState(initialEnd.date || initialStart.date);
  const [endTime, setEndTime] = useState(initialEnd.time);
  const [duration, setDuration] = useState<number | null>(null);
  const [timezone, setTimezone] = useState("");
  const endRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);
  const deadlineTouched = useRef(Boolean(deadlineValue));
  const endDateTouched = useRef(Boolean(endValue && initialEnd.date !== initialStart.date));
  const start = eventDate && startTime ? `${eventDate}T${startTime}` : "";
  const end = endDate && endTime ? `${endDate}T${endTime}` : "";
  const notifyScheduleChange = (nextStart = start, nextEnd = end) => {
    window.dispatchEvent(
      new CustomEvent("arakkis:schedule-time-change", {
        detail: { start: nextStart, end: nextEnd },
      }),
    );
  };
  const setDateValue = (value: string) => {
    setEventDate(value);
    if (!endDateTouched.current) setEndDate(value);
    if (!deadlineTouched.current && deadlineRef.current && startTime)
      deadlineRef.current.value = `${value}T${startTime}`;
    notifyScheduleChange(
      value && startTime ? `${value}T${startTime}` : "",
      value && endDate && endTime ? `${endDate === eventDate ? value : endDate}T${endTime}` : "",
    );
  };
  const setStartTimeValue = (value: string) => {
    setStartTime(value);
    if (duration !== null && endRef.current) {
      const nextEnd = addMinutes(`${eventDate}T${value}`, duration);
      setEndDate(nextEnd.slice(0, 10));
      setEndTime(nextEnd.slice(11, 16));
    }
    if (!deadlineTouched.current && deadlineRef.current && eventDate)
      deadlineRef.current.value = `${eventDate}T${value}`;
    notifyScheduleChange(
      eventDate && value ? `${eventDate}T${value}` : "",
      endDate && endTime ? `${endDate}T${endTime}` : "",
    );
  };
  useEffect(() => {
    const venue = document.querySelector<HTMLSelectElement>('select[name="venueId"]');
    const updateTimezone = () => setTimezone(venue ? (venueTimezones[venue.value] ?? "") : "");
    updateTimezone();
    venue?.addEventListener("change", updateTimezone);
    return () => venue?.removeEventListener("change", updateTimezone);
  }, [venueTimezones]);
  const readableDate = eventDate
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${eventDate}T00:00:00`))
    : "Choose a date";
  const durationMinutes =
    start && end
      ? Math.round((new Date(`${end}:00`).getTime() - new Date(`${start}:00`).getTime()) / 60000)
      : 0;
  const readableDuration =
    durationMinutes > 0
      ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 ? ` ${durationMinutes % 60}m` : ""}`
      : "Enter a valid start and end time";
  const formatTime = (value: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
      new Date(`${value}:00`),
    );
  return (
    <>
      <div className="admin-schedule-time-grid">
        <label>
          Event date
          <input
            name="scheduleDate"
            type="date"
            aria-describedby="schedule-date-help"
            required
            value={eventDate}
            className="mt-1 w-full rounded border p-2"
            onChange={(event) => setDateValue(event.currentTarget.value)}
          />
          <span id="schedule-date-help" className="admin-create-guidance">
            {readableDate}
          </span>
        </label>
        <label>
          Start time
          <input
            name="scheduleStartTime"
            type="time"
            aria-label="Start time"
            required
            value={startTime}
            className="mt-1 w-full rounded border p-2"
            onChange={(event) => setStartTimeValue(event.currentTarget.value)}
          />
          <div className="mt-3" aria-label="Duration shortcuts">
            <span className="text-sm font-medium">Quick duration</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {[60, 45, 30].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  disabled={!start}
                  aria-pressed={duration === minutes}
                  className="admin-duration-shortcut rounded border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-brand aria-pressed:bg-brand/10"
                  onClick={() => {
                    setDuration(minutes);
                    if (endRef.current) {
                      const nextEnd = addMinutes(start, minutes);
                      setEndDate(nextEnd.slice(0, 10));
                      setEndTime(nextEnd.slice(11, 16));
                    }
                    notifyScheduleChange(start, end);
                  }}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
        </label>
        <label>
          End time
          <input
            ref={endRef}
            name="scheduleEndTime"
            type="time"
            aria-label="End time"
            required
            value={endTime}
            className="mt-1 w-full rounded border p-2"
            onChange={(event) => {
              setEndTime(event.currentTarget.value);
              setDuration(null);
              notifyScheduleChange(
                start,
                endDate && event.currentTarget.value
                  ? `${endDate}T${event.currentTarget.value}`
                  : "",
              );
            }}
          />
          <span className="admin-create-guidance">Must be after the Event start.</span>
        </label>
        <label>
          End date (if different)
          <input
            name="scheduleEndDate"
            type="date"
            aria-label="End date"
            required
            value={endDate}
            className="mt-1 w-full rounded border p-2"
            onChange={(event) => {
              endDateTouched.current = true;
              setEndDate(event.currentTarget.value);
              setDuration(null);
              notifyScheduleChange(
                start,
                event.currentTarget.value && endTime
                  ? `${event.currentTarget.value}T${endTime}`
                  : "",
              );
            }}
          />
          <span className="admin-create-guidance">Use the same date for a same-day Event.</span>
        </label>
      </div>
      <input type="hidden" name="startLocal" value={start} readOnly />
      <input type="hidden" name="endLocal" value={end} readOnly />
      <div className="admin-schedule-deadline">
        <label>
          Registration deadline
          <input
            ref={deadlineRef}
            name="registrationDeadlineLocal"
            type="datetime-local"
            required
            defaultValue={deadlineValue}
            className="mt-1 w-full rounded border p-2"
            onChange={() => {
              deadlineTouched.current = true;
            }}
          />
          <span className="mt-1 block text-xs text-slate-600">
            Availability closes at this local time. Defaults to the Event start until you change it.
          </span>
        </label>
      </div>
      <div className="admin-schedule-timezone" aria-live="polite">
        <span className="admin-schedule-timezone-label">Venue timezone</span>
        <strong>{timezone || "Select a Venue to see its timezone"}</strong>
        <span>
          Participants see the Event in Venue-local time. Daylight-saving validation is applied when
          the Event is created.
        </span>
      </div>
      <div className="admin-schedule-summary" aria-live="polite">
        <strong>Schedule summary</strong>
        <span>
          {readableDate} ·{" "}
          {start && end ? `${formatTime(start)}–${formatTime(end)}` : "Choose start and end times"}{" "}
          · {timezone || "Venue timezone"}
        </span>
        <span>Duration: {readableDuration}</span>
      </div>
    </>
  );
}
