import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { InvitationManager } from "@/components/admin/invitation-manager";

export default async function InvitationsPage() {
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
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Administrator invitations</h1>
      <p className="mt-2 text-slate-600">
        System Admin-only invitation links. Links are single-use, expire after 72 hours, and are
        never emailed automatically.
      </p>
      <InvitationManager organizations={organizations ?? []} invitations={safeInvitations} />
    </section>
  );
}
