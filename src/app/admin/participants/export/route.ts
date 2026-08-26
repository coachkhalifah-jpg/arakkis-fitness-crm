import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { csvDocument } from "@/lib/services/csv";

export async function GET(request: Request) {
  const admin = await getAdminContext();
  if (!admin) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (admin.role !== "SYSTEM_ADMIN")
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json(
      { error: "Search for at least two characters before exporting" },
      { status: 400 },
    );
  }
  const db = await createClient();
  const { data, error } = await db.rpc("phase6_search_participants", {
    p_query: query,
    p_limit: 50,
  } as never);
  if (error) return NextResponse.json({ error: "People are unavailable" }, { status: 503 });

  const participants = (data ?? []) as Array<{
    first_name: string;
    last_name: string;
    display_phone: string;
    email: string | null;
  }>;
  const body = csvDocument(
    ["First Name", "Last Name", "Phone", "Email"],
    participants.map((participant) => [
      participant.first_name,
      participant.last_name,
      participant.display_phone,
      participant.email ?? "",
    ]),
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="arakkis-people.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
