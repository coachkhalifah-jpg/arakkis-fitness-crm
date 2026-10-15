import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { signOut } from "@/lib/auth/session-actions";
import { ContextualBack } from "@/components/admin/contextual-back";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { WorkoutAdminPanel } from "@/components/admin/workout-admin-panel";

export default async function AdminWorkoutsPage() {
  await requireSystemAdmin("/admin/workouts");
  const db = await createClient();
  const { data: workouts } = await db
    .from("take_home_workouts")
    .select("id,slug,title,theme,steps,updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false });

  return (
    <>
      <AdminWorkspaceMenu roleLabel="System Admin" items={getAdminWorkspaceMenuItems()} />
      <section className="admin-shell mx-auto max-w-5xl px-4 py-8">
        <ContextualBack href="/admin" label="Admin home" />
        <header className="mt-4 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            System Admin / Take-home
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Workout timers</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Configure take-home timer pages in the Workout editor, or convert a coach SlipL sheet
            into steps. Separate from Events and registration.
          </p>
        </header>

        <WorkoutAdminPanel workouts={workouts ?? []} />

        <form action={signOut} className="mt-10">
          <button type="submit" className="text-sm font-semibold underline">
            Sign out
          </button>
        </form>
      </section>
    </>
  );
}
