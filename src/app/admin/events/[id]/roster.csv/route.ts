import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { csvDocument, safeCsvFilename } from "@/lib/services/csv";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id } = await params;
  const db = await createClient();
  const { data: event, error: eventError } = await db
    .from("events")
    .select("id,name,host_organization_id")
    .eq("id", id)
    .maybeSingle();
  if (eventError || !event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (
    admin.role !== "SYSTEM_ADMIN" &&
    !admin.organizationIds.includes(event.host_organization_id)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: registrations, error: registrationError } = await db
    .from("registrations")
    .select("id,participant_id,registered_at,registration_status")
    .eq("event_id", id)
    .order("registered_at", { ascending: true });
  if (registrationError) return NextResponse.json({ error: "Roster unavailable" }, { status: 503 });

  const participantIds = (registrations ?? []).map((registration) => registration.participant_id);
  const registrationIds = (registrations ?? []).map((registration) => registration.id);
  const [
    { data: participants, error: participantError },
    { data: attendance, error: attendanceError },
  ] = await Promise.all([
    participantIds.length
      ? db
          .from("participants")
          .select("id,first_name,last_name,display_phone,email")
          .in("id", participantIds)
      : Promise.resolve({ data: [], error: null }),
    registrationIds.length
      ? db
          .from("attendance")
          .select("registration_id,status")
          .in("registration_id", registrationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (participantError || attendanceError)
    return NextResponse.json({ error: "Roster unavailable" }, { status: 503 });

  const participantById = new Map(
    (participants ?? []).map((participant) => [participant.id, participant]),
  );
  const attendanceByRegistration = new Map(
    (attendance ?? []).map((row) => [row.registration_id, row.status]),
  );
  const rows = (registrations ?? []).map((registration) => {
    const participant = participantById.get(registration.participant_id);
    return [
      participant?.first_name ?? "",
      participant?.last_name ?? "",
      participant?.display_phone ?? "",
      participant?.email ?? "",
      registration.registration_status,
      attendanceByRegistration.get(registration.id) ?? "",
      registration.registered_at,
    ];
  });
  const body = csvDocument(
    [
      "First Name",
      "Last Name",
      "Phone",
      "Email",
      "Registration Status",
      "Attendance Status",
      "Registered At",
    ],
    rows,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeCsvFilename(event.name, "event-roster")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
