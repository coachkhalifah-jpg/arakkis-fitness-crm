import Link from "next/link";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import {
  CopyPhoneButton,
  FollowUpCopyButton,
  GroupChatCopyButton,
} from "@/components/admin/follow-up-card";
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
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { SegmentedNavigation } from "@/components/admin/segmented-navigation";
import { signOut } from "@/lib/auth/session-actions";
import { SuggestedMessageEditor } from "@/components/admin/suggested-message-editor";
import { CommunityShowNav } from "@/components/admin/community-show-nav";
import { CommunityStatusNav } from "@/components/admin/community-status-nav";
import { CommunityActionCardAnchor } from "@/components/admin/community-action-card-anchor";
import { EngageRecommendationActionCard } from "@/components/admin/engage-recommendation-action-card";
import {
  selectEngageRecommendations,
  type EngageCategory,
  type EngageRecommendation,
} from "@/lib/services/engage-recommendations";
import { getEngageContextRecommendations } from "@/lib/services/engage-context";
import { groupReminderCategory } from "@/lib/services/group-reminder-categories";
import { getCommunityTouchpoints } from "@/lib/services/community-touchpoints";

const groupFilterOptions = [
  ["BEFORE_CLASS", "Before Class"],
  ["AFTER_CLASS", "After Class"],
  ["CHALLENGES", "Challenges"],
  ["TIPS", "Tips"],
  ["POLLS", "Polls"],
  ["LOGISTICS", "Logistics"],
] as const;

const communityMenuItems = [
  { href: "/admin/events", label: "Events" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/participants", label: "People" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/community", label: "Community" },
  { href: "/admin/design-assets", label: "Design" },
];

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

function formatBookingDate(value: string, timezone = "UTC") {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
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
  if (reason === "FIRST_ATTENDANCE") return "First Class";
  if (reason === "NO_SHOW") return "First No-Show";
  return title ?? "Touchpoint";
}

function isMilestone(task: { reason: string; task_title: string | null }) {
  return /milestone|third|tenth/i.test(`${task.reason} ${task.task_title ?? ""}`);
}

function oneToOnePurpose(task: { reason: string; task_title: string | null }) {
  if (task.reason === "FIRST_ATTENDANCE" || isMilestone(task)) return "Celebrate" as const;
  if (task.reason === "NO_SHOW" || /cancel/i.test(`${task.reason} ${task.task_title ?? ""}`)) {
    return "Touch Base" as const;
  }
  return "Touch Base" as const;
}

function categoryTone(label: string) {
  return label.toLowerCase().replaceAll(" ", "-");
}

function reminderLabel(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type EventRecord = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
};

function CommunityHeader() {
  return (
    <header className="community-admin-header" aria-labelledby="community-page-title">
      <p className="ops-kicker orange">System Admin / Community</p>
      <h1 id="community-page-title">
        <span>Notice</span>
        <span>The</span>
        <em>Moment.</em>
      </h1>
      <div className="community-admin-purpose">
        <p>Purpose</p>
        <h2>Coach-led touchpoints</h2>
        <p>Arakkis notices. You decide what feels useful.</p>
      </div>
    </header>
  );
}

function CommunityQueueSummary({
  needs,
  open,
  completed,
  mode = "individual",
}: {
  needs: number;
  open: number;
  completed: number;
  mode?: "individual" | "group";
}) {
  return (
    <div className="community-queue-summary" aria-label="Community queue summary">
      <div>
        <strong className="is-alert">{needs}</strong>
        <span>{mode === "group" ? "Relevant today" : "Worth noticing today"}</span>
      </div>
      <div>
        <strong>{open}</strong>
        <span>{mode === "group" ? "Open reminders" : "Open touchpoints"}</span>
      </div>
      <div>
        <strong>{completed}</strong>
        <span>{mode === "group" ? "Completed reminders" : "Completed"}</span>
      </div>
    </div>
  );
}

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    filter?: string;
    mode?: string;
    task?: string;
    reminder?: string;
    recommendation?: string;
  }>;
}) {
  await requireSystemAdmin("/admin/community");
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
  const groupFilter = groupFilterOptions.some(([value]) => value === params.filter)
    ? params.filter!
    : "BEFORE_CLASS";
  const individualFilter =
    params.filter === "CELEBRATE" || params.filter === "TOUCH_BASE"
      ? params.filter
      : "WORTH_NOTICING";
  const computedTouchpoints = mode === "individual" ? await getCommunityTouchpoints() : [];
  const contextualEngageRecommendations =
    mode === "group" ? await getEngageContextRecommendations() : [];
  const evergreenEngageRecommendations =
    mode === "group"
      ? selectEngageRecommendations({ categories: [groupFilter as EngageCategory] })
      : [];
  const db = await createClient();
  const taskQuery = db.from("follow_up_tasks").select("*").order("due_at", { ascending: true });
  const [{ data: tasks }, { data: lifecycleTasks }] = await Promise.all([
    status === "ALL" ? taskQuery : taskQuery.eq("status", status as never),
    db.from("follow_up_tasks").select("participant_id,event_id,reason"),
  ]);
  const reminderQuery = db
    .from("group_chat_reminders")
    .select("*")
    .order("due_at", { ascending: true });
  const { data: reminders } =
    status === "ALL" ? await reminderQuery : await reminderQuery.eq("status", status as never);
  const participantIds = [
    ...new Set([
      ...(tasks ?? []).map((task) => task.participant_id),
      ...computedTouchpoints.map((touchpoint) => touchpoint.participantId).filter(Boolean),
    ]),
  ] as string[];
  const taskEventIds = [
    ...new Set((tasks ?? []).map((task) => task.event_id).filter(Boolean)),
  ] as string[];
  const reminderEventIds = [
    ...new Set((reminders ?? []).map((reminder) => reminder.event_id).filter(Boolean)),
  ] as string[];
  const computedEventIds = computedTouchpoints
    .map((touchpoint) => touchpoint.eventId)
    .filter(Boolean) as string[];
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
  const eventIds = [
    ...new Set([...taskEventIds, ...reminderEventIds, ...upcomingEventIds, ...computedEventIds]),
  ];
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
  const visibleTasks = (tasks ?? []).filter((task) => {
    if (individualFilter === "WORTH_NOTICING") return true;
    return (
      oneToOnePurpose(task) === (individualFilter === "CELEBRATE" ? "Celebrate" : "Touch Base")
    );
  });
  const openTasks = visibleTasks.filter((task) => task.status === "PENDING");
  const completedTasks = visibleTasks.filter((task) => task.status !== "PENDING");
  const existingLifecycleKeys = new Set(
    (lifecycleTasks ?? [])
      .filter(
        (task) =>
          (task.reason === "FIRST_ATTENDANCE" || task.reason === "NO_SHOW") &&
          task.participant_id &&
          task.event_id,
      )
      .map((task) => `${task.reason}:${task.participant_id}:${task.event_id}`),
  );
  const computedVisible = computedTouchpoints.filter((touchpoint) => {
    if (status !== "PENDING" && status !== "ALL") return false;
    if (["NEW_CLASS", "FULL_EVENT", "LOW_ATTENDANCE_EVENT"].includes(touchpoint.type)) {
      return false;
    }
    if (
      touchpoint.type === "FIRST_CLASS" &&
      existingLifecycleKeys.has(
        `FIRST_ATTENDANCE:${touchpoint.participantId}:${touchpoint.eventId}`,
      )
    ) {
      return false;
    }
    if (
      touchpoint.type === "FIRST_NO_SHOW" &&
      existingLifecycleKeys.has(`NO_SHOW:${touchpoint.participantId}:${touchpoint.eventId}`)
    ) {
      return false;
    }
    if (individualFilter === "CELEBRATE") {
      return computedTouchpointGroup(touchpoint) === "Celebrate";
    }
    if (individualFilter === "TOUCH_BASE") {
      return computedTouchpointGroup(touchpoint) === "Touch Base";
    }
    return true;
  });
  const needsAttention = openTasks.filter((task) => {
    const event = eventById.get(task.event_id ?? "");
    return (
      task.reason === "NO_SHOW" ||
      new Date(task.due_at) < now ||
      dayKey(task.due_at, event?.timezone) === nowKey
    );
  });
  const celebrateTasks = visibleTasks.filter((task) => oneToOnePurpose(task) === "Celebrate");
  const touchBaseTasks = visibleTasks.filter((task) => oneToOnePurpose(task) === "Touch Base");
  const computedByPurpose = new Map([
    [
      "Celebrate",
      computedVisible.filter((touchpoint) => computedTouchpointGroup(touchpoint) === "Celebrate"),
    ],
    [
      "Touch Base",
      computedVisible.filter((touchpoint) => computedTouchpointGroup(touchpoint) === "Touch Base"),
    ],
  ] as const);
  const sections = [
    ["Celebrate", celebrateTasks],
    ["Touch Base", touchBaseTasks],
  ] as const;
  const selectedTask = visibleTasks.find((task) => task.id === params.task) ?? visibleTasks[0];
  if (mode === "group") {
    return (
      <GroupChatQueue
        status={status}
        filter={groupFilter}
        reminders={(reminders ?? []) as any[]}
        eventById={eventById}
        items={communityMenuItems}
        contextualRecommendations={contextualEngageRecommendations}
        evergreenRecommendations={evergreenEngageRecommendations}
        selectedReminderId={params.reminder}
        selectedRecommendationId={params.recommendation}
      />
    );
  }

  return (
    <>
      <AdminWorkspaceMenu
        roleLabel="System Admin"
        scopeLabel="All organizations"
        signOutAction={signOut}
        items={communityMenuItems}
      />
      <section
        className="follow-up-page-shell community-admin-shell admin-shell min-h-screen px-3 py-8 sm:px-8 sm:py-14"
        data-mode="individual"
      >
        <div className="follow-up-content mx-auto max-w-5xl">
          <CommunityActionCardAnchor />
          <CommunityHeader />
          <SegmentedNavigation
            listLabel="1-1"
            actionLabel="Group"
            actionHref="/admin/community?mode=group&status=PENDING"
            actionMode="group"
            className="community-mode-toggle mt-6"
          />
          <CommunityQueueSummary
            needs={needsAttention.length}
            open={openTasks.length}
            completed={completedTasks.length}
          />
          <CommunityStatusNav mode="individual" status={status} />
          <CommunityShowNav mode="individual" selected={individualFilter} status={status} />
          {status === "PENDING" ? (
            <p className="mt-5 text-sm text-slate-400">
              Showing {openTasks.length + computedVisible.length} open moment
              {openTasks.length + computedVisible.length === 1 ? "" : "s"}.
            </p>
          ) : null}
          <div className="ops-community-layout">
            <div className="ops-community-list">
              {sections.map(([heading, sectionTasks]) => {
                const sectionComputed = computedByPurpose.get(heading) ?? [];
                return sectionTasks.length || sectionComputed.length ? (
                  <section
                    key={heading}
                    className="ops-community-section"
                    aria-labelledby={heading.replaceAll(" ", "-").toLowerCase()}
                  >
                    <div className="ops-section-head">
                      <div>
                        <strong id={heading.replaceAll(" ", "-").toLowerCase()}>{heading}</strong>
                      </div>
                      <span className="ops-label">
                        {sectionTasks.length + sectionComputed.length}
                      </span>
                    </div>
                    <div className="ops-community-card-list">
                      {sectionComputed.map((touchpoint) => (
                        <ComputedTouchpointCard
                          key={touchpoint.id}
                          touchpoint={touchpoint}
                          participant={
                            touchpoint.participantId
                              ? participantById.get(touchpoint.participantId)
                              : undefined
                          }
                          event={touchpoint.eventId ? eventById.get(touchpoint.eventId) : undefined}
                        />
                      ))}
                      {sectionTasks.map((task) => (
                        <FollowUpCard
                          key={task.id}
                          task={task}
                          participant={participantById.get(task.participant_id)}
                          event={eventById.get(task.event_id ?? "")}
                          upcomingEvent={upcomingByParticipant.get(task.participant_id)}
                          assignee={
                            task.assigned_admin_id
                              ? adminById.get(task.assigned_admin_id)
                              : undefined
                          }
                          now={now}
                          compact
                          cardLabel={heading}
                          href={`/admin/community?status=${status}&task=${task.id}#selected-touchpoint`}
                          selected={selectedTask?.id === task.id}
                        />
                      ))}
                    </div>
                  </section>
                ) : null;
              })}
              {!visibleTasks.length && !computedVisible.length ? (
                <div className="ops-community-empty-state" role="status">
                  <h2>No moments here right now</h2>
                  <p>Try another view. A quiet list is useful too.</p>
                </div>
              ) : null}
            </div>
            {selectedTask ? (
              <aside
                id="selected-touchpoint"
                className="ops-community-task-detail"
                aria-label="Selected touchpoint"
              >
                <FollowUpCard
                  task={selectedTask}
                  participant={participantById.get(selectedTask.participant_id)}
                  event={eventById.get(selectedTask.event_id ?? "")}
                  upcomingEvent={upcomingByParticipant.get(selectedTask.participant_id)}
                  assignee={
                    selectedTask.assigned_admin_id
                      ? adminById.get(selectedTask.assigned_admin_id)
                      : undefined
                  }
                  now={now}
                />
              </aside>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}

function computedTouchpointGroup(touchpoint: { category: string }) {
  if (["ABSENCE", "RETURN"].includes(touchpoint.category)) return "Touch Base";
  return "Celebrate";
}

function ComputedTouchpointCard({
  touchpoint,
  participant,
  event,
}: {
  touchpoint: {
    id: string;
    category: string;
    shortReason: string;
    relevantAt: string;
    participantId?: string;
    eventId?: string;
  };
  participant?: { id: string; first_name: string; last_name: string };
  event?: EventRecord;
}) {
  return (
    <article key={touchpoint.id} className="ops-community-computed-card">
      <div className="ops-community-computed-card-header">
        <span
          className={`ops-card-index ops-card-index--${categoryTone(computedTouchpointGroup(touchpoint))}`}
        >
          {computedTouchpointGroup(touchpoint)}
        </span>
        <time dateTime={touchpoint.relevantAt}>
          {event
            ? formatDue(touchpoint.relevantAt, event.timezone)
            : formatDue(touchpoint.relevantAt)}
        </time>
      </div>
      <strong>{touchpoint.shortReason}</strong>
      <p>{participant ? `${participant.first_name} ${participant.last_name}` : "Upcoming Event"}</p>
      {event ? <small>{event.name}</small> : null}
      <div className="ops-community-computed-card-links">
        {participant ? (
          <Link href={`/admin/participants/${participant.id}`}>View person ↗</Link>
        ) : null}
        {event ? <Link href={`/admin/events/${event.id}`}>View Event ↗</Link> : null}
      </div>
    </article>
  );
}

function FollowUpCard({
  task,
  participant,
  event,
  upcomingEvent,
  assignee,
  now,
  compact = false,
  cardLabel,
  href,
  selected = false,
}: {
  task: any;
  participant?: any;
  event?: any;
  upcomingEvent?: any;
  assignee?: any;
  now: Date;
  compact?: boolean;
  cardLabel?: string;
  href?: string;
  selected?: boolean;
}) {
  const pending = task.status === "PENDING";
  const overdue = pending && new Date(task.due_at) < now;
  const timezone = event?.timezone ?? "UTC";
  const participantName = participant
    ? `${participant.first_name} ${participant.last_name}`
    : "Participant unavailable";
  if (compact && href) {
    return (
      <Link
        href={href}
        className={`ops-community-card ops-community-task ${selected ? "is-selected" : ""}`}
        aria-current={selected ? "true" : undefined}
      >
        <div className="ops-community-card-topline">
          <span
            className={`ops-card-index ${cardLabel ? `ops-card-index--${categoryTone(cardLabel)}` : ""}`}
          >
            {cardLabel ?? (pending ? "WORTH NOTICING" : task.status)}
          </span>
          <b
            className={`ops-due ${overdue ? "overdue" : task.status === "COMPLETED" ? "complete" : task.status === "DISMISSED" ? "dismissed" : "open"}`}
          >
            {overdue ? "OVERDUE" : formatDue(task.due_at, timezone)}
          </b>
        </div>
        <strong>{participantName}</strong>
        <span>{task.task_title ?? triggerLabel(task.reason, task.task_title)}</span>
        <small>
          {event ? `${event.name} · ${formatDue(event.starts_at, timezone)}` : "No event context"}
        </small>
        <i aria-hidden="true">↗</i>
      </Link>
    );
  }
  return (
    <article className="ops-community-task-detail-content">
      <div className="ops-community-detail-kicker-row">
        <span className="ops-community-detail-kicker">
          {pending ? "OPEN" : task.status} / {participantName}
        </span>
        <span className={`ops-community-detail-due ${overdue ? "is-overdue" : ""}`}>
          {overdue ? "Overdue" : "Due"} · {formatDue(task.due_at, timezone)}
        </span>
      </div>
      <h3 className="ops-community-detail-title">
        {task.task_title ?? triggerLabel(task.reason, task.task_title)}
      </h3>
      <div className="ops-community-detail-divider" />
      <dl className="ops-community-detail-facts">
        <div>
          <dt>Event</dt>
          <dd>{event?.name ?? "No event"}</dd>
        </div>
        <div>
          <dt>Upcoming booking</dt>
          <dd>
            {upcomingEvent
              ? `${upcomingEvent.name} · ${formatBookingDate(upcomingEvent.starts_at, upcomingEvent.timezone)}`
              : "No upcoming booking"}
          </dd>
        </div>
        <div>
          <dt>Coach</dt>
          <dd>{assignee?.display_name ?? assignee?.email ?? "Unassigned"}</dd>
        </div>
      </dl>
      <p className="ops-community-detail-description">
        {task.task_description ??
          (event
            ? `${task.reason === "NO_SHOW" ? "Missed" : "Attended"} ${event.name}`
            : "Touchpoint")}
      </p>
      <div className="ops-community-detail-divider" />
      <SuggestedMessageEditor
        id={`message-${task.id}`}
        initialMessage={task.suggested_message ?? ""}
        recordName="taskId"
        recordValue={task.id}
        saveAction={updateFollowUpMessage}
      >
        {pending ? (
          <FollowUpCopyButton task={{ id: task.id, suggested_message: task.suggested_message }} />
        ) : null}
      </SuggestedMessageEditor>
      {pending ? (
        <div className="ops-community-detail-actions">
          {participant?.display_phone ? (
            <CopyPhoneButton phone={participant.display_phone} />
          ) : null}
          <form
            action={snoozeFollowUpTask}
            className="ops-community-action-form ops-community-snooze-form"
          >
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="dueAt" value={addDays(1)} />
            <Button type="submit" variant="tertiary" className="ops-community-detail-action">
              Snooze
            </Button>
          </form>
          <form
            action={completeFollowUpTask}
            className="ops-community-action-form ops-community-complete-form"
          >
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="participantId" value={task.participant_id} />
            <input type="hidden" name="outcome" value="CONTACTED" />
            <Button type="submit" variant="success" className="ops-community-detail-action">
              Mark done
            </Button>
          </form>
          <form
            action={dismissFollowUpTask}
            className="ops-community-action-form ops-community-dismiss-form"
          >
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="reason" value="No longer relevant" />
            <Button type="submit" variant="secondary" className="ops-community-detail-action">
              Dismiss
            </Button>
          </form>
        </div>
      ) : (
        <p className="ops-community-detail-closed">
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
  items,
  contextualRecommendations,
  evergreenRecommendations,
  selectedReminderId,
  selectedRecommendationId,
}: {
  status: string;
  filter: string;
  reminders: any[];
  eventById: Map<string, EventRecord>;
  items: { href: string; label: string }[];
  contextualRecommendations: EngageRecommendation[];
  evergreenRecommendations: EngageRecommendation[];
  selectedReminderId?: string;
  selectedRecommendationId?: string;
}) {
  const visible = reminders.filter((reminder) => {
    return groupReminderCategory(reminder.reminder_type) === filter;
  });
  const visibleContextual = contextualRecommendations.filter(
    (recommendation) => recommendation.category === filter,
  );
  const visibleEvergreen = evergreenRecommendations.filter(
    (recommendation) => recommendation.category === filter,
  );
  const open = visible.filter((reminder) => reminder.status === "PENDING");
  const closed = visible.filter((reminder) => reminder.status !== "PENDING");
  const now = new Date();
  const needs = open.filter((reminder) => new Date(reminder.due_at) <= now);
  const selectedReminder =
    visible.find((reminder) => reminder.id === selectedReminderId) ?? visible[0];
  const visibleRecommendations = [...visibleContextual, ...visibleEvergreen];
  const selectedRecommendation = visibleRecommendations.find(
    (recommendation) => recommendation.id === selectedRecommendationId,
  );
  return (
    <>
      <AdminWorkspaceMenu
        roleLabel="System Admin"
        scopeLabel="All organizations"
        signOutAction={signOut}
        items={items}
      />
      <section
        className="follow-up-page-shell community-admin-shell admin-shell min-h-screen px-3 py-8 sm:px-8 sm:py-14"
        data-mode="group"
      >
        <div className="follow-up-content mx-auto max-w-5xl">
          <CommunityActionCardAnchor />
          <CommunityHeader />
          <SegmentedNavigation
            listLabel="1-1"
            actionLabel="Group"
            actionHref="/admin/community?mode=group&status=PENDING"
            actionMode="group"
            className="community-mode-toggle mt-6"
          />
          <CommunityQueueSummary
            needs={needs.length}
            open={open.length}
            completed={closed.length}
            mode="group"
          />
          <CommunityStatusNav mode="group" status={status} />
          <CommunityShowNav mode="group" selected={filter} status={status} />
          <div className="ops-community-layout">
            <div className="ops-community-list">
              {visibleContextual.length ? (
                <section
                  className="ops-community-section"
                  aria-labelledby="contextual-engage-recommendations"
                >
                  <div className="ops-section-head">
                    <div>
                      <span className="ops-kicker">Engage</span>
                      <strong id="contextual-engage-recommendations">
                        Contextual opportunities
                      </strong>
                    </div>
                    <span className="ops-label">{visibleContextual.length}</span>
                  </div>
                  <div className="ops-community-card-list">
                    {visibleContextual.map((recommendation) => (
                      <GroupRecommendationCard
                        key={recommendation.id}
                        recommendation={recommendation}
                        status={status}
                        filter={filter}
                        selected={selectedRecommendation?.id === recommendation.id}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              {visibleEvergreen.length ? (
                <section
                  className="ops-community-section"
                  aria-labelledby="evergreen-engage-recommendations"
                >
                  <div className="ops-section-head">
                    <div>
                      <span className="ops-kicker">Engage</span>
                      <strong id="evergreen-engage-recommendations">Ideas for the room</strong>
                    </div>
                    <span className="ops-label">{visibleEvergreen.length}</span>
                  </div>
                  <div className="ops-community-card-list">
                    {visibleEvergreen.map((recommendation) => (
                      <GroupRecommendationCard
                        key={recommendation.id}
                        recommendation={recommendation}
                        status={status}
                        filter={filter}
                        selected={selectedRecommendation?.id === recommendation.id}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              {visible.length ? (
                <section className="ops-community-section" aria-labelledby="saved-group-reminders">
                  <div className="ops-section-head">
                    <div>
                      <span className="ops-kicker">Group / Shared practice</span>
                      <strong id="saved-group-reminders">Saved reminders</strong>
                    </div>
                    <span className="ops-label">{visible.length}</span>
                  </div>
                  <div className="ops-community-card-list">
                    {visible.map((reminder) => (
                      <GroupChatCard
                        key={reminder.id}
                        reminder={reminder}
                        event={eventById.get(reminder.event_id ?? "")}
                        now={now}
                        compact
                        href={`/admin/community?mode=group&status=${status}&filter=${filter}&reminder=${reminder.id}#selected-touchpoint`}
                        selected={selectedReminder?.id === reminder.id}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              {!visible.length && !visibleContextual.length && !visibleEvergreen.length ? (
                <div className="ops-community-empty-state" role="status">
                  <h2>No group moments need attention</h2>
                  <p>When a shared practice needs a thoughtful touch, activity will appear here.</p>
                </div>
              ) : null}
            </div>
            {selectedRecommendation ? (
              <aside
                id="selected-touchpoint"
                className="ops-community-task-detail"
                aria-label="Selected Engage recommendation"
              >
                <EngageRecommendationActionCard recommendation={selectedRecommendation} />
              </aside>
            ) : selectedReminder ? (
              <aside
                id="selected-touchpoint"
                className="ops-community-task-detail"
                aria-label="Selected group reminder"
              >
                <GroupChatCard
                  reminder={selectedReminder}
                  event={eventById.get(selectedReminder.event_id ?? "")}
                  now={now}
                />
              </aside>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}

function GroupRecommendationCard({
  recommendation,
  status,
  filter,
  selected,
}: {
  recommendation: EngageRecommendation;
  status: string;
  filter: string;
  selected: boolean;
}) {
  return (
    <article
      className={`ops-community-card ops-community-group-recommendation ${selected ? "is-selected" : ""}`}
    >
      <div className="ops-community-card-topline">
        <span className="ops-card-index">{recommendation.eyebrow}</span>
        <span className="ops-community-recommendation-type">IDEA</span>
      </div>
      <strong>{recommendation.title}</strong>
      <span>{recommendation.context}</span>
      <Link
        href={`/admin/community?mode=group&status=${status}&filter=${filter}&recommendation=${encodeURIComponent(recommendation.id)}#selected-touchpoint`}
        className="ops-community-recommendation-cta"
        aria-current={selected ? "page" : undefined}
      >
        {recommendation.cta}{" "}
        <span className="arakkis-arrow-icon" aria-hidden="true">
          ↗
        </span>
      </Link>
    </article>
  );
}

function GroupChatCard({
  reminder,
  event,
  now,
  compact = false,
  href,
  selected = false,
}: {
  reminder: any;
  event?: EventRecord;
  now: Date;
  compact?: boolean;
  href?: string;
  selected?: boolean;
}) {
  const pending = reminder.status === "PENDING";
  const overdue = pending && new Date(reminder.due_at) < now;
  const timezone = event?.timezone ?? "UTC";
  if (compact && href) {
    return (
      <Link
        href={href}
        className={`ops-community-card ops-community-task ${selected ? "is-selected" : ""}`}
        aria-current={selected ? "true" : undefined}
      >
        <div className="ops-community-card-topline">
          <span className="ops-card-index">{pending ? "SAVED REMINDER" : reminder.status}</span>
          <b
            className={`ops-due ${overdue ? "overdue" : pending ? "open" : reminder.status === "COMPLETED" ? "complete" : "dismissed"}`}
          >
            {overdue ? "OVERDUE" : formatDue(reminder.due_at, timezone)}
          </b>
        </div>
        <strong>{event?.name ?? "Group touchpoint"}</strong>
        <span>{reminderLabel(reminder.reminder_type)}</span>
        <small>
          {event ? `${event.name} · ${formatDue(event.starts_at, timezone)}` : "Shared practice"}
        </small>
        <i aria-hidden="true">↗</i>
      </Link>
    );
  }
  return (
    <article className="ops-community-task-detail-content">
      <div className="ops-community-detail-kicker-row">
        <span className="ops-community-detail-kicker">{reminderLabel(reminder.reminder_type)}</span>
        <span className={`ops-community-detail-due ${overdue ? "is-overdue" : ""}`}>
          {overdue ? "Overdue" : "Due"} · {formatDue(reminder.due_at, timezone)}
        </span>
      </div>
      <h3 className="ops-community-detail-title">{event?.name ?? "Group touchpoint"}</h3>
      <div className="ops-community-detail-divider" />
      <p className="ops-community-detail-description">
        {event
          ? `Touchpoint for ${event.name}.`
          : "Suggested note; no message is sent automatically."}
      </p>
      <div className="ops-community-detail-divider" />
      <SuggestedMessageEditor
        id={`group-message-${reminder.id}`}
        initialMessage={reminder.suggested_message}
        recordName="reminderId"
        recordValue={reminder.id}
        saveAction={updateGroupChatReminderMessage}
      >
        {pending ? (
          <GroupChatCopyButton
            reminder={{ id: reminder.id, suggested_message: reminder.suggested_message }}
          />
        ) : null}
      </SuggestedMessageEditor>
      {pending ? (
        <div className="ops-community-detail-actions">
          <form
            action={snoozeGroupChatReminder}
            className="ops-community-action-form ops-community-snooze-form"
          >
            <input type="hidden" name="reminderId" value={reminder.id} />
            <input type="hidden" name="dueAt" value={addDays(1)} />
            <Button type="submit" variant="tertiary" className="ops-community-detail-action">
              Snooze
            </Button>
          </form>
          <form
            action={completeGroupChatReminder}
            className="ops-community-action-form ops-community-complete-form"
          >
            <input type="hidden" name="reminderId" value={reminder.id} />
            <input type="hidden" name="outcome" value="CONTACTED" />
            <Button type="submit" variant="success" className="ops-community-detail-action">
              Mark done
            </Button>
          </form>
          <form
            action={dismissGroupChatReminder}
            className="ops-community-action-form ops-community-dismiss-form"
          >
            <input type="hidden" name="reminderId" value={reminder.id} />
            <input type="hidden" name="reason" value="No longer relevant" />
            <Button type="submit" variant="secondary" className="ops-community-detail-action">
              Dismiss
            </Button>
          </form>
        </div>
      ) : (
        <p className="ops-community-detail-closed">
          {reminder.completion_notes ?? reminder.completion_outcome ?? "Closed"}
        </p>
      )}
    </article>
  );
}
