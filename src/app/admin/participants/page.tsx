import Link from "next/link";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";

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
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Participants</h1>
      <p className="mt-2 text-sm text-slate-600">
        System Admin operational directory. Search requires at least two characters.
      </p>
      <form className="mt-6 flex gap-2">
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
      <div className="mt-6 divide-y rounded border bg-white">
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
    </section>
  );
}
