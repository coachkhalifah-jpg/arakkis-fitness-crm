import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { signOut } from "@/lib/auth/session-actions";
import { createClient } from "@/lib/db/server";
import { ContextualBack } from "@/components/admin/contextual-back";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { ParticipantContactCorrectionForm } from "@/components/admin/participant-contact-correction-form";
import { ParticipantManageRecoveryPanel } from "@/components/admin/participant-manage-recovery-panel";
import {
  isCancellationRegistration,
  isQualifyingRegistration,
  isUpcomingRegistration,
  organizationAffiliationLabel,
  participantHistoryDetailLabel,
  participantHistoryLabel,
} from "@/lib/participants/history";
import { formatParticipantPhoneDisplay } from "@/lib/registration/normalization";

function formatEventInstant(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatAttendanceDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: timezone,
  }).format(new Date(value));
}

function telHref(normalizedPhone: string, displayPhone: string) {
  const fromNormalized = normalizedPhone.replace(/[^+\d]/g, "");
  if (fromNormalized) return `tel:${fromNormalized}`;
  return `tel:${displayPhone.replace(/[^+\d]/g, "")}`;
}

export default async function ParticipantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSystemAdmin("/admin/participants");
  const id = (await params).id;
  const db = await createClient();
  const { data: participant } = await db
    .from("participants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!participant || participant.status !== "ACTIVE") notFound();
  const { data: registrations } = await db
    .from("registrations")
    .select(
      "id,event_id,registered_at,registration_status,registration_outcome,affiliation_organization_id_at_registration",
    )
    .eq("participant_id", id)
    .order("registered_at", { ascending: false });
  const registrationRows = registrations ?? [];
  const qualifyingRegistrationCount = registrationRows.filter(isQualifyingRegistration).length;
  const cancellationCount = registrationRows.filter(isCancellationRegistration).length;
  const { data: affiliation } = participant.primary_affiliation_organization_id
    ? await db
        .from("organizations")
        .select("name,active_status")
        .eq("id", participant.primary_affiliation_organization_id)
        .maybeSingle()
    : { data: null };
  const affiliationLabel = organizationAffiliationLabel(affiliation);
  const eventIds = registrationRows.map((r) => r.event_id);
  const [{ data: events }, { data: tasks }] = await Promise.all([
    eventIds.length
      ? db
          .from("events")
          .select("id,name,starts_at,ends_at,timezone,host_organization_id,status")
          .in("id", eventIds)
      : Promise.resolve({ data: [] }),
    db
      .from("follow_up_tasks")
      .select("*")
      .eq("participant_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const registrationIds = registrationRows.map((r) => r.id);
  const [{ data: attendance }, { data: pendingRecovery }] = await Promise.all([
    registrationIds.length
      ? db
          .from("attendance")
          .select("registration_id,status,finalized_at")
          .in("registration_id", registrationIds)
      : Promise.resolve({ data: [] }),
    db
      .from("participant_manage_recovery_links")
      .select("id,expires_at,issued_at,status")
      .eq("participant_id", id)
      .eq("status", "PENDING")
      .maybeSingle(),
  ]);
  const attendanceByRegistration = new Map((attendance ?? []).map((a) => [a.registration_id, a]));
  const attendedCount = (attendance ?? []).filter(
    (a) => a.status === "ATTENDED" && a.finalized_at,
  ).length;
  const noShowCount = (attendance ?? []).filter(
    (a) => a.status === "NO_SHOW" && a.finalized_at,
  ).length;
  const attendedChronology = registrationRows
    .map((registration) => {
      const record = attendanceByRegistration.get(registration.id);
      const event = eventById.get(registration.event_id);
      if (!record || record.status !== "ATTENDED" || !record.finalized_at || !event) return null;
      return { registration, record, event };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime());
  const firstAttended = attendedChronology[0] ?? null;
  const lastAttended =
    attendedChronology.length > 0 ? attendedChronology[attendedChronology.length - 1]! : null;
  const now = new Date();
  const upcomingRegistrations = registrationRows
    .filter((registration) =>
      isUpcomingRegistration(registration, eventById.get(registration.event_id), now),
    )
    .sort((a, b) => {
      const aStart = eventById.get(a.event_id)?.starts_at ?? "";
      const bStart = eventById.get(b.event_id)?.starts_at ?? "";
      return new Date(aStart).getTime() - new Date(bStart).getTime();
    });
  const upcomingIds = new Set(upcomingRegistrations.map((registration) => registration.id));
  const historyRegistrations = registrationRows
    .filter((registration) => !upcomingIds.has(registration.id))
    .sort((a, b) => {
      const aStart = eventById.get(a.event_id)?.starts_at ?? a.registered_at;
      const bStart = eventById.get(b.event_id)?.starts_at ?? b.registered_at;
      return new Date(bStart).getTime() - new Date(aStart).getTime();
    });
  const fullName = `${participant.first_name} ${participant.last_name}`;
  const formattedPhone = formatParticipantPhoneDisplay(
    participant.display_phone,
    participant.phone_country,
  );
  const phoneLink = telHref(participant.normalized_phone, participant.display_phone);
  const goalsText =
    typeof (participant as { goals?: string | null }).goals === "string"
      ? (participant as { goals?: string | null }).goals?.trim() || ""
      : "";
  const fitnessExperience = participant.fitness_experience?.trim() || "";
  const memberLabel = participantHistoryLabel(qualifyingRegistrationCount);
  const memberDetail = participantHistoryDetailLabel(qualifyingRegistrationCount);

  const renderRegistrationRow = (r: (typeof registrationRows)[number]) => {
    const event = eventById.get(r.event_id);
    const a = attendanceByRegistration.get(r.id);
    const meta = (
      <span>
        {event ? formatEventInstant(event.starts_at, event.timezone) : "—"} · Registration{" "}
        {r.registration_status}
        {r.registration_outcome !== "ACTIVE" ? ` (${r.registration_outcome})` : ""} · Attendance{" "}
        {a?.status ?? "NOT_RECORDED"}
      </span>
    );
    if (!event) {
      return (
        <div key={r.id} className="ops-people-profile-list-row">
          <strong>Event unavailable</strong>
          {meta}
        </div>
      );
    }
    return (
      <Link key={r.id} href={`/admin/events/${event.id}`}>
        <strong>{event.name}</strong>
        {meta}
      </Link>
    );
  };

  return (
    <>
      <AdminWorkspaceMenu
        roleLabel="System Admin"
        scopeLabel="All organizations"
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems()}
      />
      <main className="ops-page ops-org-page ops-venue-page ops-people-profile-page">
        <ContextualBack href="/admin/participants" label="People" />
        <div className="ops-head ops-venue-page-head">
          <div>
            <p className="ops-kicker orange">System Admin / People</p>
            <h1>{fullName}</h1>
            <p className="ops-people-profile-contact">
              <a href={phoneLink}>{formattedPhone}</a>
              {participant.email ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <a href={`mailto:${participant.email}`}>{participant.email}</a>
                </>
              ) : (
                <>
                  <span aria-hidden="true"> · </span>
                  <span>No email</span>
                </>
              )}
            </p>
          </div>
          <div className="ops-context">
            <span className="ops-label">Current scope</span>
            <strong>All organizations</strong>
            <span className="ops-label">Primary affiliation</span>
            <strong>{affiliationLabel}</strong>
          </div>
        </div>

        <section className="ops-venue-detail-layout">
          <section className="ops-org-detail">
            <div className="ops-org-detail-head">
              <div>
                <p className="ops-kicker orange">Participation snapshot</p>
                <h2>Attendance and standing</h2>
                <p className="ops-people-profile-copy">
                  Finalized attendance and qualifying registration standing for coaching context.
                </p>
              </div>
              <span className="ops-status">Active</span>
            </div>
            <div
              className="ops-org-stats ops-people-profile-stats"
              aria-label="Participant snapshot"
            >
              <div>
                <span className="ops-label">Affiliation</span>
                <strong>{affiliationLabel}</strong>
                <small>Primary organization</small>
              </div>
              <div>
                <span className="ops-label">Member</span>
                <strong>{memberLabel}</strong>
                <small>{memberDetail}</small>
              </div>
              <div>
                <span className="ops-label">First attended</span>
                <strong>
                  {firstAttended
                    ? formatAttendanceDate(
                        firstAttended.event.starts_at,
                        firstAttended.event.timezone,
                      )
                    : "—"}
                </strong>
                <small>
                  {firstAttended ? firstAttended.event.name : "No finalized attendance yet"}
                </small>
              </div>
              <div>
                <span className="ops-label">Last attended</span>
                <strong>
                  {lastAttended
                    ? formatAttendanceDate(
                        lastAttended.event.starts_at,
                        lastAttended.event.timezone,
                      )
                    : "—"}
                </strong>
                <small>
                  {lastAttended ? lastAttended.event.name : "No finalized attendance yet"}
                </small>
              </div>
              <div>
                <span className="ops-label">Attended</span>
                <strong>{attendedCount}</strong>
                <small>Finalized attendance</small>
              </div>
              <div>
                <span className="ops-label">Cancellations</span>
                <strong>{cancellationCount}</strong>
                <small>Participant, admin, or event cancelled</small>
              </div>
              <div>
                <span className="ops-label">No-shows</span>
                <strong>{noShowCount}</strong>
                <small>Finalized no-shows</small>
              </div>
            </div>
          </section>

          <ParticipantContactCorrectionForm participant={participant} />

          {goalsText || fitnessExperience ? (
            <section className="ops-venue-events-panel" aria-labelledby="context-title">
              <div className="ops-section-head">
                <span className="ops-kicker" id="context-title">
                  Goals and context
                </span>
                <span className="ops-label">Read-only</span>
              </div>
              {goalsText ? (
                <div className="ops-people-profile-context-block">
                  <span className="ops-label">Goals</span>
                  <p className="ops-people-profile-copy">{goalsText}</p>
                </div>
              ) : null}
              {fitnessExperience ? (
                <div className="ops-people-profile-context-block">
                  <span className="ops-label">Fitness experience</span>
                  <p className="ops-people-profile-copy">{fitnessExperience}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          <ParticipantManageRecoveryPanel
            participantId={participant.id}
            displayPhone={participant.display_phone}
            phoneCountry={participant.phone_country}
            pendingLink={pendingRecovery}
          />

          <section className="ops-venue-events-panel" aria-labelledby="upcoming-title">
            <div className="ops-section-head">
              <span className="ops-kicker" id="upcoming-title">
                Upcoming
              </span>
              <span className="ops-label">Active bookings</span>
            </div>
            {upcomingRegistrations.length ? (
              <div className="ops-venue-related-list">
                {upcomingRegistrations.map(renderRegistrationRow)}
              </div>
            ) : (
              <div className="ops-empty">
                <strong>No upcoming bookings</strong>
                <p>This participant is not registered for a future Event.</p>
              </div>
            )}
          </section>

          <section className="ops-venue-events-panel" aria-labelledby="history-title">
            <div className="ops-section-head">
              <span className="ops-kicker" id="history-title">
                History
              </span>
              <span className="ops-label">Past and cancelled</span>
            </div>
            {historyRegistrations.length ? (
              <div className="ops-venue-related-list">
                {historyRegistrations.map(renderRegistrationRow)}
              </div>
            ) : (
              <div className="ops-empty">
                <strong>No history yet</strong>
                <p>Past registrations and cancelled bookings will appear here.</p>
              </div>
            )}
          </section>

          <section className="ops-venue-events-panel" aria-labelledby="follow-up-history-title">
            <div className="ops-section-head">
              <span className="ops-kicker" id="follow-up-history-title">
                Follow-up history
              </span>
              <Link className="text-button" href="/admin/community?status=ALL">
                Open follow-ups queue
              </Link>
            </div>
            {(tasks ?? []).length ? (
              <div className="ops-venue-related-list">
                {(tasks ?? []).map((task) => {
                  const statusParam =
                    task.status === "PENDING" ||
                    task.status === "COMPLETED" ||
                    task.status === "DISMISSED"
                      ? task.status
                      : "ALL";
                  return (
                    <Link
                      key={task.id}
                      href={`/admin/community?status=${statusParam}&task=${task.id}#selected-touchpoint`}
                    >
                      <strong>
                        {task.task_title} · {task.status}
                      </strong>
                      <span>
                        Due{" "}
                        {new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(task.due_at))}{" "}
                        · {eventById.get(task.event_id ?? "")?.name ?? "Event unavailable"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="ops-empty">
                <strong>No follow-up tasks</strong>
                <p>No follow-up history is on file for this participant.</p>
              </div>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
