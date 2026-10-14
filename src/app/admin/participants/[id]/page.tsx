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
import { formatParticipantPhoneDisplay } from "@/lib/registration/normalization";

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
  const fullName = `${participant.first_name} ${participant.last_name}`;
  const formattedPhone = formatParticipantPhoneDisplay(
    participant.display_phone,
    participant.phone_country,
  );

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
          </div>
          <div className="ops-context">
            <span className="ops-label">Current scope</span>
            <strong>All organizations</strong>
            <span className="ops-label">
              {formattedPhone} · {participant.email ?? "No email"}
            </span>
          </div>
        </div>

        <section className="ops-venue-detail-layout">
          <section className="ops-org-detail">
            <div className="ops-org-detail-head">
              <div>
                <p className="ops-kicker orange">Participant identity</p>
                <h2>{fullName}</h2>
                <p>
                  {formattedPhone} · {participant.email ?? "No email"}
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
                <span className="ops-label">Attended</span>
                <strong>{attendedCount}</strong>
                <small>Finalized attendance</small>
              </div>
              <div>
                <span className="ops-label">No-shows</span>
                <strong>{noShowCount}</strong>
                <small>Finalized no-shows</small>
              </div>
              <div>
                <span className="ops-label">History</span>
                <strong>{participantHistoryLabel(qualifyingRegistrationCount)}</strong>
                <small>Qualifying registrations</small>
              </div>
            </div>
          </section>

          <ParticipantContactCorrectionForm participant={participant} />
          <ParticipantManageRecoveryPanel
            participantId={participant.id}
            displayPhone={participant.display_phone}
            phoneCountry={participant.phone_country}
            pendingLink={pendingRecovery}
          />

          <section className="ops-venue-events-panel" aria-labelledby="goals-title">
            <div className="ops-section-head">
              <span className="ops-kicker" id="goals-title">
                Goals
              </span>
              <span className="ops-label">Read-only</span>
            </div>
            <p className="ops-people-profile-copy">
              {participant.goals?.trim() ? participant.goals : "No goals on file."}
            </p>
          </section>

          <section
            className="ops-venue-events-panel"
            aria-labelledby="registration-attendance-title"
          >
            <div className="ops-section-head">
              <span className="ops-kicker" id="registration-attendance-title">
                Registration and attendance
              </span>
            </div>
            {(registrations ?? []).length ? (
              <div className="ops-venue-related-list">
                {(registrations ?? []).map((r) => {
                  const event = eventById.get(r.event_id);
                  const a = attendanceByRegistration.get(r.id);
                  return (
                    <div key={r.id} className="ops-people-profile-list-row">
                      <strong>{event?.name ?? "Event unavailable"}</strong>
                      <span>
                        {event
                          ? new Intl.DateTimeFormat("en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: event.timezone,
                            }).format(new Date(event.starts_at))
                          : "—"}{" "}
                        · Registration {r.registration_status} · Attendance{" "}
                        {a?.status ?? "NOT_RECORDED"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ops-empty">
                <strong>No registrations yet</strong>
                <p>This participant has not registered for an Event.</p>
              </div>
            )}
          </section>

          <section className="ops-venue-events-panel" aria-labelledby="follow-up-history-title">
            <div className="ops-section-head">
              <span className="ops-kicker" id="follow-up-history-title">
                Follow-up history
              </span>
            </div>
            {(tasks ?? []).length ? (
              <div className="ops-venue-related-list">
                {(tasks ?? []).map((task) => (
                  <div key={task.id} className="ops-people-profile-list-row">
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
                  </div>
                ))}
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
