import Link from "next/link";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { FollowUpCopyButton, GroupChatCopyButton } from "@/components/admin/follow-up-card";
import {
  completeFollowUpTask,
  dismissFollowUpTask,
  completeGroupChatReminder,
  dismissGroupChatReminder,
  snoozeGroupChatReminder,
  updateGroupChatReminderMessage,
  snoozeFollowUpTask,
  updateFollowUpMessage,
} from "@/lib/services/phase-6-actions";
import { Button } from "@/components/ui/button";
import { CommunityModeNav } from "@/components/admin/community-mode-nav";

const filterOptions = [
  ["ALL_OPEN", "All Open"],
  ["DUE_TODAY", "Due Today"],
  ["OVERDUE", "Overdue"],
  ["FIRST_CLASS", "First Class"],
  ["NO_SHOW", "No-Show"],
  ["MILESTONES", "Milestones"],
  ["CANCELLATIONS", "Cancellations"],
  ["ASSIGNED_TO_ME", "Assigned to Me"],
] as const;

const groupFilterOptions = [
  ["ALL", "All"],
  ["BEFORE_CLASS", "Before Class"],
  ["AFTER_CLASS", "After Class"],
  ["WELCOMES", "Welcomes"],
  ["MILESTONES", "Milestones"],
  ["CHALLENGES", "Challenges"],
  ["TIPS", "Tips"],
  ["POLLS", "Polls"],
  ["LOGISTICS", "Logistics"],
] as const;

function dayKey(value: string | Date, timezone = "UTC") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(value));
}

function formatDue(value: string, timezone = "UTC") {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function addDays(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  value.setHours(9, 0, 0, 0);
  return value.toISOString();
}

function triggerLabel(reason: string, title: string | null) {
  if (reason === "FIRST_ATTENDANCE") return "First Class Attended";
  if (reason === "NO_SHOW") return "No-Show";
  return title ?? "Follow-Up";
}

function triggerTone(reason: string, title: string | null) {
  const value = `${reason} ${title ?? ""}`.toLowerCase();
  if (value.includes("no_show") || value.includes("no-show")) return "no-show";
  if (value.includes("third")) return "third-milestone";
  if (value.includes("tenth")) return "tenth-milestone";
  if (value.includes("return")) return "returning";
  if (value.includes("cancel")) return "cancellation";
  if (value.includes("first")) return "first-class";
  return "community";
}

function isMilestone(task: { reason: string; task_title: string | null }) {
  return /milestone|third|tenth/i.test(`${task.reason} ${task.task_title ?? ""}`);
}

function reminderLabel(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function reminderGroup(type: string) {
  if (["CLASS_PREVIEW", "ATTENDANCE_CHECK_IN"].includes(type)) return "BEFORE_CLASS";
  if (["POST_CLASS_REFLECTION", "WELCOME_FIRST_TIME"].includes(type)) return "AFTER_CLASS";
  if (type.includes("MILESTONE")) return "MILESTONES";
  if (type === "WEEKLY_CHALLENGE") return "CHALLENGES";
  if (type === "WEEKLY_TIP") return "TIPS";
  if (type === "COMMUNITY_POLL") return "POLLS";
  return "LOGISTICS";
}

type EventRecord = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
};

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; filter?: string; mode?: string }>;
}) {
  const admin = await requireSystemAdmin("/admin/follow-ups");
  const params = await searchParams;
  const mode = params.mode === "group" ? "group" : "individual";
  const status =
    params.status === "ALL"
      ? "ALL"
      : params.status === "COMPLETED"
        ? "COMPLETED"
        : params.status === "DISMISSED"
          ? "DISMISSED"
          : "PENDING";
  const filter = filterOptions.some(([value]) => value === params.filter)
    ? params.filter!
    : "ALL_OPEN";
  const groupFilter = groupFilterOptions.some(([value]) => value === params.filter)
    ? params.filter!
    : "ALL";
  const db = await createClient();
  const query = db.from("follow_up_tasks").select("*").order("due_at", { ascending: true });
  const { data: tasks } =
    status === "ALL" ? await query : await query.eq("status", status as never);
  const reminderQuery = db
    .from("group_chat_reminders")
    .select("*")
    .order("due_at", { ascending: true });
  const { data: reminders } =
    status === "ALL" ? await reminderQuery : await reminderQuery.eq("status", status as never);
  const participantIds = [...new Set((tasks ?? []).map((task) => task.participant_id))];
  const taskEventIds = [
    ...new Set((tasks ?? []).map((task) => task.event_id).filter(Boolean)),
  ] as string[];
  const reminderEventIds = [
    ...new Set((reminders ?? []).map((reminder) => reminder.event_id).filter(Boolean)),
  ] as string[];
  const [{ data: participants }, { data: registrations }] = await Promise.all([
    participantIds.length
      ? db
          .from("participants")
          .select("id,first_name,last_name,display_phone")
          .in("id", participantIds)
      : Promise.resolve({ data: [] }),
    participantIds.length
      ? db
          .from("registrations")
          .select("participant_id,event_id,registration_status,registration_outcome")
          .in("participant_id", participantIds)
          .eq("registration_status", "REGISTERED")
          .eq("registration_outcome", "ACTIVE")
      : Promise.resolve({ data: [] }),
  ]);
  const upcomingEventIds = [
    ...new Set((registrations ?? []).map((registration) => registration.event_id)),
  ];
  const eventIds = [...new Set([...taskEventIds, ...reminderEventIds, ...upcomingEventIds])];
  const [{ data: events }, { data: admins }] = await Promise.all([
    eventIds.length
      ? db.from("events").select("id,name,starts_at,ends_at,timezone,status").in("id", eventIds)
      : Promise.resolve({ data: [] }),
    db.from("admin_profiles").select("id,display_name,email").eq("status", "ACTIVE"),
  ]);
  const participantById = new Map(
    (participants ?? []).map((participant) => [participant.id, participant]),
  );
  const eventRecords = (events ?? []) as EventRecord[];
  const eventById = new Map(eventRecords.map((event) => [event.id, event]));
  const adminById = new Map((admins ?? []).map((assignee) => [assignee.id, assignee]));
  const upcomingByParticipant = new Map<string, EventRecord>();
  const now = new Date();
  for (const registration of registrations ?? []) {
    const event = eventById.get(registration.event_id);
    if (
      event &&
      event.status === "OPEN" &&
      new Date(event.starts_at) > now &&
      (!upcomingByParticipant.has(registration.participant_id) ||
        new Date(event.starts_at) <
          new Date(upcomingByParticipant.get(registration.participant_id)!.starts_at))
    ) {
      upcomingByParticipant.set(registration.participant_id, event);
    }
  }
  const nowKey = dayKey(now);
  const weekLimit = new Date(now);
  weekLimit.setDate(weekLimit.getDate() + 7);
  const visibleTasks = (tasks ?? []).filter((task) => {
    if (task.status !== "PENDING") return status === "ALL" || status !== "PENDING";
    const event = eventById.get(task.event_id ?? "");
    const timezone = event?.timezone ?? "UTC";
    const dueDate = new Date(task.due_at);
    if (filter === "DUE_TODAY") return dayKey(task.due_at, timezone) === nowKey;
    if (filter === "OVERDUE") return dueDate < now;
    if (filter === "FIRST_CLASS") return task.reason === "FIRST_ATTENDANCE";
    if (filter === "NO_SHOW") return task.reason === "NO_SHOW";
    if (filter === "MILESTONES") return isMilestone(task);
    if (filter === "CANCELLATIONS")
      return /cancel/i.test(`${task.reason} ${task.task_title ?? ""}`);
    if (filter === "ASSIGNED_TO_ME") return task.assigned_admin_id === admin.userId;
    return true;
  });
  const openTasks = visibleTasks.filter((task) => task.status === "PENDING");
  const completedTasks = visibleTasks.filter((task) => task.status !== "PENDING");
  const needsAttention = openTasks.filter((task) => {
    const event = eventById.get(task.event_id ?? "");
    return (
      task.reason === "NO_SHOW" ||
      new Date(task.due_at) < now ||
      dayKey(task.due_at, event?.timezone) === nowKey
    );
  });
  const needsIds = new Set(needsAttention.map((task) => task.id));
  const community = openTasks.filter((task) => isMilestone(task));
  const communityIds = new Set(community.map((task) => task.id));
  const thisWeek = openTasks.filter((task) => {
    const due = new Date(task.due_at);
    return !needsIds.has(task.id) && !communityIds.has(task.id) && due <= weekLimit;
  });
  const sections = [
    ["Needs Attention Today", needsAttention],
    ["Follow Up This Week", thisWeek],
    ["Community Check-Ins", community],
  ] as const;
  const linkFor = (nextFilter: string) => `/admin/follow-ups?status=${status}&filter=${nextFilter}`;
  const commonFilters = filterOptions.slice(0, 3);
  const moreFilters = filterOptions.slice(3);
  const activeFilterLabel = filterOptions.find(([value]) => value === filter)?.[1];

  if (mode === "group") {
    return (
      <GroupChatQueue
        status={status}
        filter={groupFilter}
        reminders={(reminders ?? []) as any[]}
        eventById={eventById}
      />
    );
  }

  return (
    <section
      className="follow-up-page-shell admin-shell min-h-screen px-3 py-8 sm:px-8 sm:py-14"
      data-mode="individual"
    >
      <div className="follow-up-content mx-auto max-w-5xl">
        <div className="admin-page-header">
          <p className="admin-eyebrow">Community engagement queue</p>
          <h1>Community</h1>
          <p>Welcome participants, strengthen retention, and keep the class connected.</p>
          <div className="follow-up-summary" aria-label="Queue summary">
            <span>
              Needs Attention Today <strong>{needsAttention.length}</strong>
            </span>
            <span>
              Follow Up This Week <strong>{thisWeek.length}</strong>
            </span>
            <span>
              Community Posts{" "}
              <strong>
                {reminders?.filter((reminder) => reminder.status === "PENDING").length ?? 0}
              </strong>
            </span>
            <span>
              Completed <strong>{completedTasks.length}</strong>
            </span>
          </div>
        </div>
        <CommunityModeNav mode="individual" />
        <nav className="follow-up-status-nav mt-6" aria-label="Follow-up status">
          <Link href="/admin/follow-ups?status=PENDING" data-selected={status === "PENDING"}>
            Open
          </Link>
          <Link href="/admin/follow-ups?status=COMPLETED" data-selected={status === "COMPLETED"}>
            Completed
          </Link>
          <Link href="/admin/follow-ups?status=DISMISSED" data-selected={status === "DISMISSED"}>
            Dismissed
          </Link>
          <Link href="/admin/follow-ups?status=ALL" data-selected={status === "ALL"}>
            All
          </Link>
        </nav>
        {status !== "COMPLETED" && status !== "DISMISSED" ? (
          <div className="follow-up-filter-shell mt-4">
            <div className="follow-up-filter-nav" aria-label="Follow-up filters">
              {commonFilters.map(([value, label]) => (
                <Link key={value} href={linkFor(value)} data-selected={filter === value}>
                  {label}
                </Link>
              ))}
              <details
                open={moreFilters.some(([value]) => value === filter)}
                className="follow-up-more-filters"
              >
                <summary>
                  More Filters{moreFilters.some(([value]) => value === filter) ? " · Active" : ""}
                </summary>
                <div className="follow-up-more-filter-list">
                  {moreFilters.map(([value, label]) => (
                    <Link key={value} href={linkFor(value)} data-selected={filter === value}>
                      {label}
                    </Link>
                  ))}
                </div>
              </details>
              {filter !== "ALL_OPEN" ? (
                <Link href={`/admin/follow-ups?status=${status}`}>Clear Filters</Link>
              ) : null}
            </div>
            {filter !== "ALL_OPEN" ? (
              <p className="follow-up-active-filter">
                Active filter: <strong>{activeFilterLabel}</strong>
              </p>
            ) : null}
          </div>
        ) : null}
        {status === "PENDING" ? (
          <p className="mt-5 text-sm text-slate-400">
            Showing {openTasks.length} open task{openTasks.length === 1 ? "" : "s"}. Supported
            triggers currently include first attendance and finalized no-shows.
          </p>
        ) : null}
        {sections.map(([heading, sectionTasks]) =>
          sectionTasks.length ? (
            <section
              key={heading}
              className="mt-8"
              aria-labelledby={heading.replaceAll(" ", "-").toLowerCase()}
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2
                  id={heading.replaceAll(" ", "-").toLowerCase()}
                  className="text-xl font-semibold"
                >
                  {heading}
                </h2>
                <span className="text-sm text-slate-400">{sectionTasks.length}</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {sectionTasks.map((task) => (
                  <FollowUpCard
                    key={task.id}
                    task={task}
                    participant={participantById.get(task.participant_id)}
                    event={eventById.get(task.event_id ?? "")}
                    upcomingEvent={upcomingByParticipant.get(task.participant_id)}
                    assignee={
                      task.assigned_admin_id ? adminById.get(task.assigned_admin_id) : undefined
                    }
                    now={now}
                  />
                ))}
              </div>
            </section>
          ) : null,
        )}
        {completedTasks.length ? (
          <details className="mt-8 rounded-3xl border border-slate-200 bg-slate-100 p-5">
            <summary className="cursor-pointer font-semibold">
              Completed · {completedTasks.length}
            </summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {completedTasks.map((task) => (
                <FollowUpCard
                  key={task.id}
                  task={task}
                  participant={participantById.get(task.participant_id)}
                  event={eventById.get(task.event_id ?? "")}
                  upcomingEvent={upcomingByParticipant.get(task.participant_id)}
                  assignee={
                    task.assigned_admin_id ? adminById.get(task.assigned_admin_id) : undefined
                  }
                  now={now}
                />
              ))}
            </div>
          </details>
        ) : null}
        {!visibleTasks.length ? (
          <p className="mt-10 text-slate-400">No tasks in this view.</p>
        ) : null}
      </div>
    </section>
  );
}

function FollowUpCard({
  task,
  participant,
  event,
  upcomingEvent,
  assignee,
  now,
}: {
  task: any;
  participant?: any;
  event?: any;
  upcomingEvent?: any;
  assignee?: any;
  now: Date;
}) {
  const pending = task.status === "PENDING";
  const overdue = pending && new Date(task.due_at) < now;
  const timezone = event?.timezone ?? "UTC";
  const participantName = participant
    ? `${participant.first_name} ${participant.last_name}`
    : "Participant unavailable";
  return (
    <article className={`follow-up-card ${overdue ? "follow-up-card-overdue" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span
            className={`follow-up-trigger-badge follow-up-trigger-${triggerTone(task.reason, task.task_title)}`}
          >
            {triggerLabel(task.reason, task.task_title)}
          </span>
          <h3 className="mt-2 text-xl font-semibold">{participantName}</h3>
        </div>
        <span className={`follow-up-due ${overdue ? "follow-up-due-overdue" : ""}`}>
          {overdue ? "Overdue" : "Due"} · {formatDue(task.due_at, timezone)}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-300">
        {task.task_description ??
          (event
            ? `${task.reason === "NO_SHOW" ? "Missed" : "Attended"} ${event.name}`
            : "Follow-up task")}
      </p>
      {event ? (
        <p className="mt-2 text-sm text-slate-400">
          Relevant occurrence: {event.name} · {formatDue(event.starts_at, timezone)}
        </p>
      ) : null}
      {upcomingEvent ? (
        <p className="mt-1 text-sm text-slate-400">
          Upcoming booking: {upcomingEvent.name} ·{" "}
          {formatDue(upcomingEvent.starts_at, upcomingEvent.timezone)}
        </p>
      ) : null}
      <p className="mt-1 text-sm text-slate-400">
        Assigned to: {assignee?.display_name ?? assignee?.email ?? "Unassigned"}
      </p>
      <form action={updateFollowUpMessage} className="follow-up-message-form mt-4">
        <div className="follow-up-message-heading">
          <label className="block text-sm font-semibold" htmlFor={`message-${task.id}`}>
            Suggested message
          </label>
          {pending ? (
            <FollowUpCopyButton task={{ id: task.id, suggested_message: task.suggested_message }} />
          ) : null}
        </div>
        <textarea
          id={`message-${task.id}`}
          name="suggestedMessage"
          defaultValue={task.suggested_message ?? ""}
          className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900"
          disabled={!pending}
        />
        <input type="hidden" name="taskId" value={task.id} />
        {pending ? (
          <Button type="submit" variant="secondary" className="mt-2">
            Save message
          </Button>
        ) : null}
      </form>
      {pending ? (
        <div className="follow-up-actions mt-4 flex flex-wrap items-center gap-2">
          {participant?.display_phone ? (
            <a className="ui-button ui-button-secondary" href={`tel:${participant.display_phone}`}>
              Call
            </a>
          ) : null}
          <form action={snoozeFollowUpTask} className="flex items-center gap-2">
            <input type="hidden" name="taskId" value={task.id} />
            <select
              name="dueAt"
              aria-label={`Snooze ${participantName}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-900"
            >
              <option value={addDays(1)}>Tomorrow</option>
              <option value={addDays(3)}>In 3 days</option>
              <option value={addDays(7)}>Next week</option>
            </select>
            <Button type="submit" variant="tertiary">
              Snooze
            </Button>
          </form>
          <form action={completeFollowUpTask} className="flex items-center gap-2">
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="participantId" value={task.participant_id} />
            <select
              name="outcome"
              aria-label={`Completion outcome for ${participantName}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-900"
            >
              <option value="CONTACTED">Contacted</option>
              <option value="NO_RESPONSE">No response</option>
              <option value="FOLLOW_UP_NOT_NEEDED">Not needed</option>
              <option value="WRONG_CONTACT_INFORMATION">Wrong contact</option>
            </select>
            <Button type="submit" variant="success">
              Complete
            </Button>
          </form>
          <form action={dismissFollowUpTask} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="taskId" value={task.id} />
            <input
              name="reason"
              required
              placeholder="Dismissal reason"
              aria-label={`Dismissal reason for ${participantName}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-900"
            />
            <Button type="submit" variant="secondary">
              Dismiss
            </Button>
          </form>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          {task.completion_outcome ?? task.completion_notes ?? "Closed"}
        </p>
      )}
    </article>
  );
}

function GroupChatQueue({
  status,
  filter,
  reminders,
  eventById,
}: {
  status: string;
  filter: string;
  reminders: any[];
  eventById: Map<string, EventRecord>;
}) {
  const visible = reminders.filter((reminder) => {
    if (filter !== "ALL" && reminderGroup(reminder.reminder_type) !== filter) return false;
    return true;
  });
  const open = visible.filter((reminder) => reminder.status === "PENDING");
  const closed = visible.filter((reminder) => reminder.status !== "PENDING");
  const now = new Date();
  const needs = open.filter((reminder) => new Date(reminder.due_at) <= now);
  const needsIds = new Set(needs.map((reminder) => reminder.id));
  const community = open.filter((reminder) =>
    ["WELCOME_FIRST_TIME", "THIRD_CLASS_MILESTONE", "TENTH_CLASS_MILESTONE"].includes(
      reminder.reminder_type,
    ),
  );
  const communityIds = new Set(community.map((reminder) => reminder.id));
  const week = open.filter(
    (reminder) => !needsIds.has(reminder.id) && !communityIds.has(reminder.id),
  );
  const sections = [
    ["Needs Attention Today", needs],
    ["Follow Up This Week", week],
    ["Community Check-Ins", community],
  ] as const;
  const linkFor = (nextFilter: string) =>
    `/admin/follow-ups?mode=group&status=${status}&filter=${nextFilter}`;
  return (
    <section
      className="follow-up-page-shell admin-shell min-h-screen px-3 py-8 sm:px-8 sm:py-14"
      data-mode="group"
    >
      <div className="follow-up-content mx-auto max-w-5xl">
        <div className="admin-page-header">
          <p className="admin-eyebrow">Community engagement queue</p>
          <h1>Community</h1>
          <p>Welcome participants, strengthen retention, and keep the class connected.</p>
          <div className="follow-up-summary" aria-label="Queue summary">
            <span>
              Needs Attention Today <strong>{needs.length}</strong>
            </span>
            <span>
              Follow Up This Week <strong>{week.length}</strong>
            </span>
            <span>
              Community Posts <strong>{open.length}</strong>
            </span>
            <span>
              Completed <strong>{closed.length}</strong>
            </span>
          </div>
        </div>
        <CommunityModeNav mode="group" />
        <nav className="follow-up-status-nav mt-5" aria-label="Group chat reminder status">
          <Link
            href="/admin/follow-ups?mode=group&status=PENDING"
            data-selected={status === "PENDING"}
          >
            Open
          </Link>
          <Link
            href="/admin/follow-ups?mode=group&status=COMPLETED"
            data-selected={status === "COMPLETED"}
          >
            Completed
          </Link>
          <Link
            href="/admin/follow-ups?mode=group&status=DISMISSED"
            data-selected={status === "DISMISSED"}
          >
            Dismissed
          </Link>
          <Link href="/admin/follow-ups?mode=group&status=ALL" data-selected={status === "ALL"}>
            All
          </Link>
        </nav>
        {status !== "COMPLETED" && status !== "DISMISSED" ? (
          <GroupChatFilters filter={filter} status={status} />
        ) : null}
        {sections.map(([heading, sectionReminders]) =>
          sectionReminders.length ? (
            <section
              key={heading}
              className="mt-8"
              aria-labelledby={`group-${heading.replaceAll(" ", "-").toLowerCase()}`}
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2
                  id={`group-${heading.replaceAll(" ", "-").toLowerCase()}`}
                  className="text-xl font-semibold"
                >
                  {heading}
                </h2>
                <span className="text-sm text-slate-400">{sectionReminders.length}</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {sectionReminders.map((reminder) => (
                  <GroupChatCard
                    key={reminder.id}
                    reminder={reminder}
                    event={eventById.get(reminder.event_id ?? "")}
                    now={now}
                  />
                ))}
              </div>
            </section>
          ) : null,
        )}
        {closed.length ? (
          <details className="mt-8 rounded-3xl border border-slate-200 bg-slate-100 p-5">
            <summary className="cursor-pointer font-semibold">Completed · {closed.length}</summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {closed.map((reminder) => (
                <GroupChatCard
                  key={reminder.id}
                  reminder={reminder}
                  event={eventById.get(reminder.event_id ?? "")}
                  now={now}
                />
              ))}
            </div>
          </details>
        ) : null}
        {!visible.length ? (
          <p className="mt-10 text-slate-400">No reminders in this view.</p>
        ) : null}
      </div>
    </section>
  );
}

function GroupChatFilters({ filter, status }: { filter: string; status: string }) {
  const commonFilters = groupFilterOptions.slice(0, 3);
  const moreFilters = groupFilterOptions.slice(3);
  const activeFilterLabel = groupFilterOptions.find(([value]) => value === filter)?.[1];
  const linkFor = (nextFilter: string) =>
    `/admin/follow-ups?mode=group&status=${status}&filter=${nextFilter}`;
  const moreActive = moreFilters.some(([value]) => value === filter);
  return (
    <div className="follow-up-filter-shell mt-4">
      <div className="follow-up-filter-nav" aria-label="Group chat filters">
        {commonFilters.map(([value, label]) => (
          <Link key={value} href={linkFor(value)} data-selected={filter === value}>
            {label}
          </Link>
        ))}
        <details open={moreActive} className="follow-up-more-filters">
          <summary>More Filters{moreActive ? " · Active" : ""}</summary>
          <div className="follow-up-more-filter-list">
            {moreFilters.map(([value, label]) => (
              <Link key={value} href={linkFor(value)} data-selected={filter === value}>
                {label}
              </Link>
            ))}
          </div>
        </details>
        {filter !== "ALL" ? (
          <Link href={`/admin/follow-ups?mode=group&status=${status}`}>Clear Filters</Link>
        ) : null}
      </div>
      {filter !== "ALL" ? (
        <p className="follow-up-active-filter">
          Active filter: <strong>{activeFilterLabel}</strong>
        </p>
      ) : null}
    </div>
  );
}

function GroupChatCard({
  reminder,
  event,
  now,
}: {
  reminder: any;
  event?: EventRecord;
  now: Date;
}) {
  const pending = reminder.status === "PENDING";
  const overdue = pending && new Date(reminder.due_at) < now;
  const timezone = event?.timezone ?? "UTC";
  return (
    <article className={`follow-up-card ${overdue ? "follow-up-card-overdue" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span
            className={`follow-up-trigger-badge follow-up-trigger-${triggerTone(reminder.reminder_type, reminder.reminder_type)}`}
          >
            {reminderLabel(reminder.reminder_type)}
          </span>
          <h3 className="mt-2 text-xl font-semibold">{event?.name ?? "Community reminder"}</h3>
        </div>
        <span className={`follow-up-due ${overdue ? "follow-up-due-overdue" : ""}`}>
          {overdue ? "Overdue" : "Due"} · {formatDue(reminder.due_at, timezone)}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-300">
        {event
          ? `Reminder for ${event.name}.`
          : "Copyable community reminder; no external message is sent."}
      </p>
      <form action={updateGroupChatReminderMessage} className="follow-up-message-form mt-4">
        <div className="follow-up-message-heading">
          <label className="block text-sm font-semibold" htmlFor={`group-message-${reminder.id}`}>
            Suggested message
          </label>
          {pending ? (
            <GroupChatCopyButton
              reminder={{ id: reminder.id, suggested_message: reminder.suggested_message }}
            />
          ) : null}
        </div>
        <textarea
          id={`group-message-${reminder.id}`}
          name="suggestedMessage"
          defaultValue={reminder.suggested_message}
          className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900"
          disabled={!pending}
        />
        <input type="hidden" name="reminderId" value={reminder.id} />
        {pending ? (
          <Button type="submit" variant="secondary" className="mt-2">
            Save message
          </Button>
        ) : null}
      </form>
      {pending ? (
        <div className="follow-up-actions mt-4 flex flex-wrap items-center gap-2">
          <form action={snoozeGroupChatReminder} className="flex items-center gap-2">
            <input type="hidden" name="reminderId" value={reminder.id} />
            <select
              name="dueAt"
              aria-label={`Snooze ${reminderLabel(reminder.reminder_type)}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-900"
            >
              <option value={addDays(1)}>Tomorrow</option>
              <option value={addDays(3)}>In 3 days</option>
              <option value={addDays(7)}>Next week</option>
            </select>
            <Button type="submit" variant="tertiary">
              Snooze
            </Button>
          </form>
          <form action={completeGroupChatReminder}>
            <input type="hidden" name="reminderId" value={reminder.id} />
            <Button type="submit" variant="success">
              Complete
            </Button>
          </form>
          <form action={dismissGroupChatReminder} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="reminderId" value={reminder.id} />
            <input
              name="reason"
              required
              placeholder="Dismissal reason"
              aria-label={`Dismissal reason for ${reminderLabel(reminder.reminder_type)}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-900"
            />
            <Button type="submit" variant="secondary">
              Dismiss
            </Button>
          </form>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          {reminder.completion_notes ?? reminder.completion_outcome ?? "Closed"}
        </p>
      )}
    </article>
  );
}
