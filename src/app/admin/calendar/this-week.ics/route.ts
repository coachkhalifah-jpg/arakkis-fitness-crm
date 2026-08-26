import { requireActiveAdmin } from "@/lib/authorization/server";
import { icsContent } from "@/lib/registration/calendar";
import { getAuthorizedCalendarEvents } from "@/lib/services/admin-calendar";

export async function GET() {
  const admin = await requireActiveAdmin("/admin");
  const calendarEvents = await getAuthorizedCalendarEvents(admin);
  if (!calendarEvents) return new Response("Calendar unavailable", { status: 503 });
  if (calendarEvents.length === 0)
    return new Response("No qualifying Events this week", { status: 404 });

  return new Response(icsContent(calendarEvents), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="arakkis-this-week.ics"',
      "Cache-Control": "no-store",
    },
  });
}
