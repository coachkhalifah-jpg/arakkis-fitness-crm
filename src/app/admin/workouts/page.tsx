import Link from "next/link";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { signOut } from "@/lib/auth/session-actions";
import { ContextualBack } from "@/components/admin/contextual-back";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { WorkoutImportForm } from "@/components/admin/workout-import-form";
import { retireTakeHomeWorkout } from "@/lib/workouts/actions";

export default async function AdminWorkoutsPage() {
  await requireSystemAdmin("/admin/workouts");
  const db = await createClient();
  const { data: workouts } = await db
    .from("take_home_workouts")
    .select("id,slug,title,steps,updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false });

  return (
    <>
      <AdminWorkspaceMenu roleLabel="System Admin" items={getAdminWorkspaceMenuItems()} />
      <section className="admin-shell mx-auto max-w-3xl px-4 py-8">
        <ContextualBack href="/admin" label="Admin home" />
        <header className="mt-4 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            System Admin / Take-home
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Workout timers</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Import a CSV to create or replace public take-home timer pages. This is separate from
            Events and registration and does not change booking capacity or confirmations.
          </p>
        </header>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Import CSV</h2>
          <div className="mt-4">
            <WorkoutImportForm />
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Active workouts</h2>
          {(workouts ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No take-home workouts imported yet.</p>
          ) : (
            <ul className="space-y-3">
              {(workouts ?? []).map((workout) => {
                const stepCount = Array.isArray(workout.steps) ? workout.steps.length : 0;
                return (
                  <li
                    key={workout.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{workout.title}</p>
                      <p className="text-sm text-slate-600">
                        /workouts/{workout.slug} · {stepCount} steps
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/workouts/${workout.slug}`}
                        className="text-sm font-semibold underline"
                      >
                        Open page
                      </Link>
                      <form action={retireTakeHomeWorkout}>
                        <input type="hidden" name="slug" value={workout.slug} />
                        <button type="submit" className="text-sm font-semibold text-red-700">
                          Retire
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form action={signOut} className="mt-10">
          <button type="submit" className="text-sm font-semibold underline">
            Sign out
          </button>
        </form>
      </section>
    </>
  );
}
