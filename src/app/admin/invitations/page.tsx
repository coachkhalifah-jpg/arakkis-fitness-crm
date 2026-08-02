import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { InvitationManager } from "@/components/admin/invitation-manager";
import { SegmentedNavigation } from "@/components/admin/segmented-navigation";
import { ContextualBack } from "@/components/admin/contextual-back";

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
    <section className="admin-shell px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative mx-auto max-w-3xl pt-8">
        <ContextualBack />
        <div className="admin-page-header">
          <h1>Invitations</h1>
          <p>Invite scoped administrators without exposing raw tokens.</p>
          <SegmentedNavigation
            listLabel="Invitations"
            actionLabel="Invite"
            actionHref="/admin/invitations?mode=invite"
            actionMode="invite"
          />
        </div>
        <InvitationManager
          organizations={organizations ?? []}
          invitations={safeInvitations}
          mode={mode}
        />
      </div>
    </section>
  );
}
