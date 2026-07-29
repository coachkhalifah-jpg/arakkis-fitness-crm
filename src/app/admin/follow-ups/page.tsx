import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { FollowUpCopyButton } from "@/components/admin/follow-up-card";
import {
  completeFollowUpTask,
  dismissFollowUpTask,
  updateFollowUpMessage,
} from "@/lib/services/phase-6-actions";

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireSystemAdmin("/admin/follow-ups");
  const status = (await searchParams).status ?? "PENDING";
  const db = await createClient();
  const query = db.from("follow_up_tasks").select("*").order("due_at", { ascending: true });
  const { data: tasks } =
    status === "ALL" ? await query : await query.eq("status", status as never);
  const participantIds = [...new Set((tasks ?? []).map((task) => task.participant_id))];
  const eventIds = [
    ...new Set((tasks ?? []).map((task) => task.event_id).filter(Boolean)),
  ] as string[];
  const [{ data: participants }, { data: events }] = await Promise.all([
    participantIds.length
      ? db.from("participants").select("id,first_name,last_name").in("id", participantIds)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? db.from("events").select("id,name,timezone").in("id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);
  const participantById = new Map((participants ?? []).map((p) => [p.id, p]));
  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const { data: currentTime } = await db.rpc("phase6_now", {} as never);
  const now = currentTime ? Date.parse(String(currentTime)) : 0;
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Follow-Ups</h1>
      <p className="mt-2 text-sm text-slate-600">
        Manual accountability queue. Copying never sends or completes a message.
      </p>
      <nav className="mt-6 flex gap-2 text-sm">
        <a href="/admin/follow-ups?status=PENDING" className="rounded border px-3 py-2">
          Open
        </a>
        <a href="/admin/follow-ups?status=COMPLETED" className="rounded border px-3 py-2">
          Completed
        </a>
        <a href="/admin/follow-ups?status=DISMISSED" className="rounded border px-3 py-2">
          Dismissed
        </a>
        <a href="/admin/follow-ups?status=ALL" className="rounded border px-3 py-2">
          All
        </a>
      </nav>
      <div className="mt-6 space-y-4">
        {(tasks ?? []).map((task) => {
          const p = participantById.get(task.participant_id);
          const event = eventById.get(task.event_id ?? "");
          const overdue = task.status === "PENDING" && new Date(task.due_at).getTime() < now;
          return (
            <article
              key={task.id}
              className={`rounded border bg-white p-5 ${overdue ? "border-red-300" : ""}`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    {p ? `${p.first_name} ${p.last_name}` : "Participant unavailable"}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {task.task_title} · {event?.name ?? "Event unavailable"}
                  </p>
                </div>
                <span className={overdue ? "font-semibold text-red-700" : "text-slate-600"}>
                  {overdue ? "Overdue · " : "Due · "}
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: event?.timezone,
                  }).format(new Date(task.due_at))}
                </span>
              </div>
              <form action={updateFollowUpMessage} className="mt-4">
                <input type="hidden" name="taskId" value={task.id} />
                <textarea
                  name="suggestedMessage"
                  defaultValue={task.suggested_message ?? ""}
                  className="min-h-24 w-full rounded border p-2"
                  disabled={task.status !== "PENDING"}
                />
                {task.status === "PENDING" ? (
                  <button className="mt-2 rounded border px-3 py-1 text-sm">Save message</button>
                ) : null}
              </form>
              {task.status === "PENDING" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <FollowUpCopyButton
                    task={{ id: task.id, suggested_message: task.suggested_message }}
                  />
                  <form action={completeFollowUpTask} className="flex gap-2">
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="participantId" value={task.participant_id} />
                    <select name="outcome" className="rounded border p-1">
                      <option value="CONTACTED">Contacted</option>
                      <option value="NO_RESPONSE">No response</option>
                      <option value="FOLLOW_UP_NOT_NEEDED">Not needed</option>
                      <option value="WRONG_CONTACT_INFORMATION">Wrong contact</option>
                    </select>
                    <button className="rounded bg-brand px-3 py-1 text-sm text-white">
                      Complete
                    </button>
                  </form>
                  <form action={dismissFollowUpTask} className="flex gap-2">
                    <input type="hidden" name="taskId" value={task.id} />
                    <input
                      name="reason"
                      required
                      placeholder="Dismissal reason"
                      className="rounded border p-1"
                    />
                    <button className="rounded border px-3 py-1 text-sm">Dismiss</button>
                  </form>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  {task.completion_outcome ?? task.completion_notes ?? "Closed"}
                </p>
              )}
            </article>
          );
        })}
      </div>
      {!(tasks ?? []).length ? <p className="mt-8 text-slate-600">No tasks in this view.</p> : null}
    </section>
  );
}
