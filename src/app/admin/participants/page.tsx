import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { PeopleDirectory, type PeopleRecord } from "@/components/admin/people-directory";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { signOut } from "@/lib/auth/session-actions";
import {
  isQualifyingRegistration,
  organizationAffiliationLabel,
  participantHistoryLabel,
} from "@/lib/participants/history";

const PEOPLE_PAGE_SIZE = 25;

type DirectoryParticipant = {
  id: string;
  first_name: string;
  last_name: string;
  display_phone: string;
  email: string | null;
  primary_affiliation_organization_id: string | null;
  total_count?: number | string;
};

function formatEventDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireSystemAdmin("/admin/participants");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const hasQuery = q.length >= 2;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1);
  const db = await createClient();

  let participants: DirectoryParticipant[] = [];
  let error: { message: string } | null = null;
  let totalCount = 0;

  let currentPage = page;

  if (hasQuery) {
    const result = await db.rpc("phase6_search_participants", {
      p_query: q,
      p_limit: 50,
    } as never);
    error = result.error;
    const matches = (result.data ?? []) as DirectoryParticipant[];
    totalCount = matches.length;
    const searchPages = Math.max(1, Math.ceil(totalCount / PEOPLE_PAGE_SIZE) || 1);
    currentPage = Math.min(page, searchPages);
    participants = matches.slice(
      (currentPage - 1) * PEOPLE_PAGE_SIZE,
      currentPage * PEOPLE_PAGE_SIZE,
    );
  } else {
    const result = await db.rpc("phase6_list_participants", {
      p_page: page,
      p_page_size: PEOPLE_PAGE_SIZE,
    } as never);
    error = result.error;
    participants = (result.data ?? []) as DirectoryParticipant[];
    totalCount = Number(participants[0]?.total_count ?? 0);

    // Window totals only appear on returned rows; clamp when the page is past the end.
    if (!error && !participants.length && page > 1) {
      const firstPage = await db.rpc("phase6_list_participants", {
        p_page: 1,
        p_page_size: PEOPLE_PAGE_SIZE,
      } as never);
      error = firstPage.error;
      const firstRows = (firstPage.data ?? []) as DirectoryParticipant[];
      totalCount = Number(firstRows[0]?.total_count ?? 0);
      const listPages = Math.max(1, Math.ceil(totalCount / PEOPLE_PAGE_SIZE) || 1);
      currentPage = Math.min(page, listPages);
      if (totalCount > 0 && currentPage !== 1) {
        const clamped = await db.rpc("phase6_list_participants", {
          p_page: currentPage,
          p_page_size: PEOPLE_PAGE_SIZE,
        } as never);
        error = clamped.error;
        participants = (clamped.data ?? []) as DirectoryParticipant[];
        totalCount = Number(participants[0]?.total_count ?? totalCount);
      } else {
        participants = firstRows;
        currentPage = 1;
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PEOPLE_PAGE_SIZE) || 1);
  currentPage = Math.min(currentPage, totalPages);
  const participantIds = participants.map((participant) => participant.id);
  const organizationIds = participants
    .map((participant) => participant.primary_affiliation_organization_id)
    .filter(Boolean) as string[];

  const [{ data: organizations }, { data: registrations }] = await Promise.all([
    organizationIds.length
      ? db.from("organizations").select("id,name,active_status").in("id", organizationIds)
      : Promise.resolve({ data: [] }),
    participantIds.length
      ? db
          .from("registrations")
          .select(
            "id,participant_id,event_id,registered_at,registration_status,registration_outcome",
          )
          .in("participant_id", participantIds)
          .order("registered_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const registrationRows = registrations ?? [];
  const eventIds = [...new Set(registrationRows.map((registration) => registration.event_id))];
  const [{ data: events }, { data: attendance }] = await Promise.all([
    eventIds.length
      ? db
          .from("events")
          .select("id,name,starts_at,timezone,host_organization_id")
          .in("id", eventIds)
      : Promise.resolve({ data: [] }),
    registrationRows.length
      ? db
          .from("attendance")
          .select("registration_id,status,finalized_at")
          .in(
            "registration_id",
            registrationRows.map((registration) => registration.id),
          )
      : Promise.resolve({ data: [] }),
  ]);

  const organizationById = new Map(
    (organizations ?? []).map((organization) => [organization.id, organization]),
  );
  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const attendanceByRegistration = new Map(
    (attendance ?? []).map((entry) => [entry.registration_id, entry]),
  );
  const records: PeopleRecord[] = participants.map((participant) => {
    const name = `${participant.first_name} ${participant.last_name}`;
    const organization = organizationAffiliationLabel(
      participant.primary_affiliation_organization_id
        ? organizationById.get(participant.primary_affiliation_organization_id)
        : null,
    );
    const participantRegistrations = registrationRows.filter(
      (registration) => registration.participant_id === participant.id,
    );
    const activeRegistrations = participantRegistrations.filter(isQualifyingRegistration);
    const upcomingRegistration = activeRegistrations
      .map((registration) => ({ registration, event: eventById.get(registration.event_id) }))
      .filter(({ event }) => event && new Date(event.starts_at) >= new Date())
      .sort(
        (a, b) => new Date(a.event!.starts_at).getTime() - new Date(b.event!.starts_at).getTime(),
      )[0];
    const latestRegistration = participantRegistrations[0];
    const latestEvent = latestRegistration ? eventById.get(latestRegistration.event_id) : undefined;
    const attended = participantRegistrations
      .map((registration) => attendanceByRegistration.get(registration.id))
      .filter((entry) => entry?.status === "ATTENDED" && entry.finalized_at);
    const lastCheckedIn =
      attended[0]?.finalized_at && latestEvent
        ? `last checked in ${formatEventDate(attended[0].finalized_at, latestEvent.timezone)}`
        : "attendance recorded";

    return {
      id: participant.id,
      name,
      phone: participant.display_phone,
      email: participant.email,
      organization,
      registered: participantHistoryLabel(activeRegistrations.length),
      attendance: attended.length
        ? `${attended.length} attended · ${lastCheckedIn}`
        : "No attendance recorded",
      booking: upcomingRegistration?.event
        ? `${upcomingRegistration.event.name} · ${formatEventDate(upcomingRegistration.event.starts_at, upcomingRegistration.event.timezone)}`
        : "No upcoming booking",
      event: latestEvent
        ? `${latestEvent.name} · ${formatEventDate(latestEvent.starts_at, latestEvent.timezone)}`
        : "No recent Event",
    };
  });

  return (
    <>
      <AdminWorkspaceMenu
        roleLabel="System Admin"
        scopeLabel="All organizations"
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems()}
      />
      <PeopleDirectory
        key={`${q}:${currentPage}`}
        query={q}
        people={records}
        page={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        error={error?.message}
      />
    </>
  );
}
