import Link from "next/link";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { ContextualBack } from "@/components/admin/contextual-back";

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSystemAdmin("/admin/participants");
  const q = (await searchParams).q?.trim() ?? "";
  const db = await createClient();
  const { data: rawParticipants, error } =
    q.length >= 2
      ? await db.rpc("phase6_search_participants", { p_query: q, p_limit: 50 } as never)
      : { data: [], error: null };
  const participants = (rawParticipants ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    display_phone: string;
    email: string | null;
  }>;
  return (
    <section className="admin-shell px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative mx-auto max-w-6xl pt-8">
        <ContextualBack />
        <p className="admin-eyebrow">Participant CRM</p>
        <h1 className="mt-2 text-4xl font-semibold">Participants</h1>
        <p className="mt-2 text-sm text-slate-600">
          System Admin operational directory. Search requires at least two characters.
        </p>
        <form className="admin-surface mt-6 flex gap-2 rounded-3xl p-4">
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, phone, or email"
            className="w-full rounded border p-2"
          />
          <button className="rounded bg-brand px-4 py-2 text-white">Search</button>
        </form>
        {error ? (
          <p className="mt-6 rounded border border-red-200 bg-red-50 p-4">
            Participants are unavailable.
          </p>
        ) : null}
        <div className="admin-surface mt-6 divide-y rounded-3xl">
          {(participants ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/admin/participants/${p.id}`}
              className="block p-4 hover:bg-slate-50"
            >
              <span className="font-medium">
                {p.first_name} {p.last_name}
              </span>
              <span className="ml-3 text-sm text-slate-600">
                {p.display_phone} · {p.email ?? "No email"}
              </span>
            </Link>
          ))}
        </div>
        {q.length >= 2 && !(participants ?? []).length && !error ? (
          <p className="mt-6 text-slate-600">No matching active participants.</p>
        ) : null}
      </div>
    </section>
  );
}
