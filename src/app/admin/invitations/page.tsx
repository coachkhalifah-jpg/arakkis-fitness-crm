import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { signOut } from "@/lib/auth/session-actions";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { InvitationManager } from "@/components/admin/invitation-manager";
import { SegmentedNavigation } from "@/components/admin/segmented-navigation";

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireSystemAdmin();
  const db = await createClient();
  const [{ data: organizations }, { data: invitations }, { data: assignments }] = await Promise.all(
    [
      db.from("organizations").select("id,name").eq("active_status", "ACTIVE").order("name"),
      db
        .from("admin_invitations")
        .select("id,invited_email,role,status,token_expires_at,issued_at,accepted_at")
        .order("issued_at", { ascending: false }),
      db.from("admin_invitation_organizations").select("invitation_id,organization_id"),
    ],
  );
  const names = new Map(
    (organizations ?? []).map((organization) => [organization.id, organization.name]),
  );
  const assignmentMap = new Map<string, string[]>();
  for (const assignment of assignments ?? [])
    assignmentMap.set(assignment.invitation_id, [
      ...(assignmentMap.get(assignment.invitation_id) ?? []),
      names.get(assignment.organization_id) ?? "Unavailable organization",
    ]);
  const safeInvitations = (invitations ?? []).map((invitation) => ({
    ...invitation,
    organizationNames: assignmentMap.get(invitation.id) ?? [],
  }));
  const mode = (await searchParams).mode === "invite" ? "invite" : "list";
  return (
    <>
      <AdminWorkspaceMenu
        roleLabel="System Admin"
        scopeLabel="All organizations"
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems()}
      />
      <main className="page ops-page ops-invitations-page">
        <div className="ops-invitations-content">
          <header className="ops-invitations-head">
            <p className="ops-kicker orange">05 / Scoped access</p>
            <h1>
              <span>Invite</span>
              <span>The</span>
              <em>Right</em>
              <em>People.</em>
            </h1>
            <p className="ops-invitations-intro">
              Provide scoped Admin access without exposing raw invitation tokens. Every invitation
              is tied to an Organization and expires on its schedule.
            </p>
          </header>
          <SegmentedNavigation
            listLabel="Invitations"
            actionLabel="Invite"
            actionHref="/admin/invitations?mode=invite"
            actionMode="invite"
            listMeta={String(safeInvitations.length)}
            actionIcon="+"
            className="ops-invitations-mode-nav"
          />
          <InvitationManager
            organizations={organizations ?? []}
            invitations={safeInvitations}
            mode={mode}
          />
        </div>
      </main>
    </>
  );
}
