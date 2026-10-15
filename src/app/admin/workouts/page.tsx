import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { signOut } from "@/lib/auth/session-actions";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { WorkoutAdminPanel } from "@/components/admin/workout-admin-panel";

export default async function AdminWorkoutsPage() {
  const admin = await requireSystemAdmin("/admin/workouts");
  const db = await createClient();
  const { data: workouts } = await db
    .from("take_home_workouts")
    .select("id,slug,title,theme,steps,updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false });

  return (
    <>
      <AdminWorkspaceMenu
        roleLabel="System Admin"
        scopeLabel={
          admin.role === "SYSTEM_ADMIN" ? "All organizations" : admin.organizationNames.join(" · ")
        }
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems()}
      />
      <section className="admin-shell admin-events-page admin-create-event-page admin-workouts-page">
        <div className="admin-events-page-shell">
          <div className="admin-events-head">
            <div className="admin-page-header">
              <p className="admin-events-kicker">System Admin / Take-home</p>
              <h1>
                <span>Build the</span>
                <em>timer.</em>
              </h1>
              <p className="admin-events-subtext">
                Set slug, title, and theme here. Load a coach sheet into steps, then save a public
                run page — separate from Events and People.
              </p>
            </div>
          </div>

          <WorkoutAdminPanel workouts={workouts ?? []} />
        </div>
      </section>
    </>
  );
}
