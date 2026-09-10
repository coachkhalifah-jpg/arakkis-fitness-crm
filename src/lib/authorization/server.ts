import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { signInPath } from "@/lib/auth/redirects";

export type AdminRole = "SYSTEM_ADMIN" | "HOST_ADMIN";

export type AdminContext = {
  userId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  organizationIds: string[];
  organizationNames: string[];
};

export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("id, display_name, email, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "ACTIVE") return null;
  if (profile.role !== "SYSTEM_ADMIN" && profile.role !== "HOST_ADMIN") return null;

  const { data: assignments, error: assignmentError } = await supabase
    .from("admin_organization_assignments")
    .select("organization_id")
    .eq("admin_profile_id", user.id)
    .is("revoked_at", null);

  if (assignmentError) return null;
  let organizationNames: string[] = [];
  const assignedOrganizationIds = (assignments ?? []).map(
    (assignment) => assignment.organization_id,
  );
  let organizationIds = assignedOrganizationIds;
  if (assignedOrganizationIds.length > 0) {
    const { data: organizations, error: organizationError } = await supabase
      .from("organizations")
      .select("id, name")
      .in("id", assignedOrganizationIds)
      .eq("active_status", "ACTIVE");
    if (organizationError) return null;
    organizationNames = (organizations ?? []).map((organization) => organization.name);
    const activeOrganizationIds = new Set(
      (organizations ?? []).map((organization) => organization.id),
    );
    organizationIds = assignedOrganizationIds.filter((id) => activeOrganizationIds.has(id));
  }

  if (profile.role === "HOST_ADMIN" && organizationIds.length === 0) return null;

  return {
    userId: user.id,
    email: user.email,
    displayName: profile.display_name,
    role: profile.role,
    organizationIds,
    organizationNames,
  };
}

export async function requireAuthenticatedUser(next = "/admin") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(signInPath(next));
  return user;
}

export async function requireActiveAdmin(next = "/admin") {
  await requireAuthenticatedUser(next);
  const context = await getAdminContext();
  if (!context) redirect("/admin/access-denied");
  return context;
}

export async function requireSystemAdmin(next = "/admin") {
  const context = await requireActiveAdmin(next);
  if (context.role !== "SYSTEM_ADMIN") redirect("/admin/access-denied");
  return context;
}

export async function requireHostAdmin(next = "/admin") {
  const context = await requireActiveAdmin(next);
  if (context.role !== "HOST_ADMIN") redirect("/admin/access-denied");
  return context;
}

export async function requireOrganizationAccess(organizationId: string, next = "/admin") {
  const context = await requireActiveAdmin(next);
  if (context.role !== "SYSTEM_ADMIN" && !context.organizationIds.includes(organizationId)) {
    redirect("/admin/access-denied");
  }
  return context;
}
