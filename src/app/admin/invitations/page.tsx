import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { signOut } from "@/lib/auth/session-actions";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { InvitationManager } from "@/components/admin/invitation-manager";
import { AdminAccessManager } from "@/components/admin/admin-access-manager";
import { SegmentedNavigation } from "@/components/admin/segmented-navigation";

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireSystemAdmin();
  const db = await createClient();
  const [
    { data: organizations },
    { data: invitations },
    { data: invitationAssignments },
    { data: profiles },
    { data: adminAssignments },
  ] = await Promise.all([
    db.from("organizations").select("id,name,active_status").order("name"),
    db
      .from("admin_invitations")
      .select("id,invited_email,role,status,token_expires_at,issued_at,accepted_at")
      .order("issued_at", { ascending: false }),
    db.from("admin_invitation_organizations").select("invitation_id,organization_id"),
    db.from("admin_profiles").select("id,display_name,email,role,status").order("email"),
    db
      .from("admin_organization_assignments")
      .select("admin_profile_id,organization_id,revoked_at")
      .order("created_at"),
  ]);
  const names = new Map(
    (organizations ?? []).map((organization) => [organization.id, organization.name]),
  );
  const assignmentMap = new Map<string, string[]>();
  for (const assignment of invitationAssignments ?? [])
    assignmentMap.set(assignment.invitation_id, [
      ...(assignmentMap.get(assignment.invitation_id) ?? []),
      names.get(assignment.organization_id) ?? "Unavailable organization",
    ]);
  const safeInvitations = (invitations ?? []).map((invitation) => ({
    ...invitation,
    organizationNames: assignmentMap.get(invitation.id) ?? [],
  }));
  const adminAssignmentMap = new Map<string, string[]>();
  for (const assignment of adminAssignments ?? []) {
    if (assignment.revoked_at) continue;
    adminAssignmentMap.set(assignment.admin_profile_id, [
      ...(adminAssignmentMap.get(assignment.admin_profile_id) ?? []),
      assignment.organization_id,
    ]);
  }
  const safeAdmins = (profiles ?? []).map((profile) => {
    const organizationIds = adminAssignmentMap.get(profile.id) ?? [];
    return {
      ...profile,
      organizationIds,
      organizationNames: organizationIds.map(
        (organizationId) => names.get(organizationId) ?? "Unavailable organization",
      ),
    };
  });
  const activeOrganizations = (organizations ?? []).filter(
    (organization) => organization.active_status === "ACTIVE",
  );
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
            organizations={activeOrganizations}
            invitations={safeInvitations}
            mode={mode}
          />
          <AdminAccessManager admins={safeAdmins} organizations={activeOrganizations} />
        </div>
      </main>
    </>
  );
}
