import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { signOut } from "@/lib/auth/session-actions";
import { createClient } from "@/lib/db/server";
import { ContextualBack } from "@/components/admin/contextual-back";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
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
  const { data: attendance } = registrationIds.length
    ? await db
        .from("attendance")
        .select("registration_id,status,finalized_at")
        .in("registration_id", registrationIds)
    : { data: [] };
  const attendanceByRegistration = new Map((attendance ?? []).map((a) => [a.registration_id, a]));
  return (
    <>
      <AdminWorkspaceMenu
        roleLabel="System Admin"
        scopeLabel="All organizations"
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems()}
      />
      <section className="admin-shell px-5 py-10 sm:px-8 sm:py-14">
        <div className="relative mx-auto max-w-3xl pt-8">
          <ContextualBack href="/admin/participants" label="People" />
          <div className="admin-page-header">
            <h1>
              {participant.first_name} {participant.last_name}
            </h1>
            <p>
              {participant.display_phone} · {participant.email ?? "No email"}
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded border bg-white p-4">
              <p className="text-sm text-slate-500">Affiliation</p>
              <p>{affiliationLabel}</p>
            </div>
            <div className="rounded border bg-white p-4">
              <p className="text-sm text-slate-500">Attended</p>
              <p>
                {(attendance ?? []).filter((a) => a.status === "ATTENDED" && a.finalized_at).length}
              </p>
            </div>
            <div className="rounded border bg-white p-4">
              <p className="text-sm text-slate-500">No-shows</p>
              <p>
                {(attendance ?? []).filter((a) => a.status === "NO_SHOW" && a.finalized_at).length}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded border bg-white p-4">
            <p className="text-sm text-slate-500">Participant history</p>
            <p>{participantHistoryLabel(qualifyingRegistrationCount)}</p>
          </div>
          <div className="mt-8 rounded border bg-white p-6">
            <h2 className="text-xl font-semibold">Goals</h2>
            <p className="mt-2 whitespace-pre-wrap text-slate-700">
              {participant.goals ?? "No goals provided."}
            </p>
          </div>
          <div className="mt-8 rounded border bg-white p-6">
            <h2 className="text-xl font-semibold">Registration and attendance history</h2>
            <div className="mt-4 divide-y">
              {(registrations ?? []).map((r) => {
                const event = eventById.get(r.event_id);
                const a = attendanceByRegistration.get(r.id);
                return (
                  <div key={r.id} className="py-3">
                    <p className="font-medium">{event?.name ?? "Event unavailable"}</p>
                    <p className="text-sm text-slate-600">
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
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-8 rounded border bg-white p-6">
            <h2 className="text-xl font-semibold">Follow-up history</h2>
            <div className="mt-4 divide-y">
              {(tasks ?? []).map((task) => (
                <div key={task.id} className="py-3">
                  <p className="font-medium">
                    {task.task_title} · {task.status}
                  </p>
                  <p className="text-sm text-slate-600">
                    Due{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(task.due_at))}{" "}
                    · {eventById.get(task.event_id ?? "")?.name ?? "Event unavailable"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
