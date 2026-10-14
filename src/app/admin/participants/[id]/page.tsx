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
  isQualifyingRegistration,
  organizationAffiliationLabel,
  participantHistoryLabel,
} from "@/lib/participants/history";

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
  const qualifyingRegistrationCount = (registrations ?? []).filter(isQualifyingRegistration).length;
  const { data: affiliation } = participant.primary_affiliation_organization_id
    ? await db
        .from("organizations")
        .select("name,active_status")
        .eq("id", participant.primary_affiliation_organization_id)
        .maybeSingle()
    : { data: null };
  const affiliationLabel = organizationAffiliationLabel(affiliation);
  const eventIds = (registrations ?? []).map((r) => r.event_id);
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
  const registrationIds = (registrations ?? []).map((r) => r.id);
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

  return (
    <>
      <AdminWorkspaceMenu
        roleLabel="System Admin"
        scopeLabel="All organizations"
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems()}
      />
      <main className="people-profile-page">
        <div className="people-profile-shell">
          <ContextualBack href="/admin/participants" label="People" />
          <header className="people-profile-header">
            <div>
              <p className="people-directory-kicker">People profile</p>
              <h1>
                {participant.first_name} {participant.last_name}
              </h1>
              <p className="people-profile-lede">
                {participant.display_phone}
                <span aria-hidden="true"> · </span>
                {participant.email ?? "No email"}
              </p>
            </div>
            <div className="people-directory-scope" aria-label="People profile scope">
              <span>System Admin</span>
              <strong>All organizations</strong>
            </div>
          </header>

          <section className="people-profile-stats" aria-label="Participant snapshot">
            <article className="people-profile-stat">
              <span>Affiliation</span>
              <strong>{affiliationLabel}</strong>
            </article>
            <article className="people-profile-stat">
              <span>Attended</span>
              <strong>{attendedCount}</strong>
            </article>
            <article className="people-profile-stat">
              <span>No-shows</span>
              <strong>{noShowCount}</strong>
            </article>
            <article className="people-profile-stat people-profile-stat-wide">
              <span>Participant history</span>
              <strong>{participantHistoryLabel(qualifyingRegistrationCount)}</strong>
            </article>
          </section>

          <ParticipantContactCorrectionForm participant={participant} />
          <ParticipantManageRecoveryPanel
            participantId={participant.id}
            displayPhone={participant.display_phone}
            pendingLink={pendingRecovery}
          />

          <section className="people-profile-panel" aria-labelledby="goals-title">
            <p className="people-profile-panel-kicker">Historical</p>
            <h2 id="goals-title">Goals</h2>
            <p className="people-profile-panel-body">
              {participant.goals?.trim()
                ? participant.goals
                : "No goals on file. Public registration no longer collects goals."}
            </p>
          </section>

          <section className="people-profile-panel" aria-labelledby="registration-attendance-title">
            <p className="people-profile-panel-kicker">History</p>
            <h2 id="registration-attendance-title">Registration and attendance</h2>
            <div className="people-profile-list">
              {(registrations ?? []).length === 0 ? (
                <p className="people-profile-empty">No registrations yet.</p>
              ) : (
                (registrations ?? []).map((r) => {
                  const event = eventById.get(r.event_id);
                  const a = attendanceByRegistration.get(r.id);
                  return (
                    <article key={r.id} className="people-profile-list-item">
                      <strong>{event?.name ?? "Event unavailable"}</strong>
                      <p>
                        {event
                          ? new Intl.DateTimeFormat("en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: event.timezone,
                            }).format(new Date(event.starts_at))
                          : "—"}{" "}
                        · Registration {r.registration_status} · Attendance{" "}
                        {a?.status ?? "NOT_RECORDED"}
                      </p>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="people-profile-panel" aria-labelledby="follow-up-history-title">
            <p className="people-profile-panel-kicker">Follow-up</p>
            <h2 id="follow-up-history-title">Follow-up history</h2>
            <div className="people-profile-list">
              {(tasks ?? []).length === 0 ? (
                <p className="people-profile-empty">No follow-up tasks.</p>
              ) : (
                (tasks ?? []).map((task) => (
                  <article key={task.id} className="people-profile-list-item">
                    <strong>
                      {task.task_title} · {task.status}
                    </strong>
                    <p>
                      Due{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(task.due_at))}{" "}
                      · {eventById.get(task.event_id ?? "")?.name ?? "Event unavailable"}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
