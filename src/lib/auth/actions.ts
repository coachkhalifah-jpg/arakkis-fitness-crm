"use server";

import { createPrivilegedClient } from "@/lib/db/privileged";
import { createClient } from "@/lib/db/server";
import { getServerEnv } from "@/lib/config/env";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createInvitationToken, hashInvitationToken } from "@/lib/auth/tokens";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type AuthActionState = { error?: string; success?: string };

const GENERIC_INVITATION_ERROR = "This invitation is invalid or no longer available.";
const GENERIC_ADMIN_LIFECYCLE_ERROR = "Administrator access could not be changed.";

export async function createHostInvitation(formData: FormData) {
  const actor = await requireSystemAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const organizationIds = String(formData.get("organizationIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!email || organizationIds.length === 0)
    return { error: "Email and organization assignment are required." };

  const { token, tokenHash } = createInvitationToken();
  const privileged = createPrivilegedClient();
  const expires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const { data: invitation, error: invitationError } = await privileged.rpc(
    "create_admin_invitation",
    {
      p_invited_email: email,
      p_token_hash: tokenHash,
      p_token_expires_at: expires,
      p_invited_by_admin_id: actor.userId,
      p_organization_ids: organizationIds,
    },
  );
  if (invitationError || !invitation) return { error: "Invitation could not be created." };

  const env = getServerEnv();
  return {
    inviteUrl: `${env.NEXT_PUBLIC_APP_URL}/admin/invitations/accept?token=${encodeURIComponent(token)}`,
  };
}

export async function revokeInvitation(invitationId: string) {
  const actor = await requireSystemAdmin();
  const privileged = createPrivilegedClient();
  const { data: revoked, error } = await privileged.rpc("revoke_admin_invitation", {
    p_invitation_id: invitationId,
    p_actor_admin_id: actor.userId,
  });
  if (error || !revoked) return { error: "Invitation could not be revoked." };
  return { success: "Invitation revoked." };
}

export async function regenerateInvitation(invitationId: string) {
  const actor = await requireSystemAdmin();
  const { token, tokenHash } = createInvitationToken();
  const privileged = createPrivilegedClient();
  const expires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const { data: regenerated, error } = await privileged.rpc("regenerate_admin_invitation", {
    p_invitation_id: invitationId,
    p_token_hash: tokenHash,
    p_token_expires_at: expires,
    p_actor_admin_id: actor.userId,
  });
  if (error || !regenerated) return { error: "Invitation could not be regenerated." };
  const env = getServerEnv();
  return {
    inviteUrl: `${env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL}/admin/invitations/accept?token=${encodeURIComponent(token)}`,
  };
}

export async function manageAdminAccess(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const actor = await requireSystemAdmin("/admin/invitations");
  const intent = String(formData.get("intent") ?? "");
  const adminProfileId = String(formData.get("adminProfileId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const privileged = createPrivilegedClient();

  const requests: Record<string, { rpc: string; args: Record<string, string> }> = {
    DEACTIVATE_HOST_ADMIN: {
      rpc: "deactivate_admin_profile",
      args: {
        p_admin_profile_id: adminProfileId,
        p_actor_admin_id: actor.userId,
        p_reason: reason,
      },
    },
    REACTIVATE_HOST_ADMIN: {
      rpc: "reactivate_admin_profile",
      args: {
        p_admin_profile_id: adminProfileId,
        p_actor_admin_id: actor.userId,
        p_reason: reason,
      },
    },
    ADD_HOST_ADMIN_ASSIGNMENT: {
      rpc: "add_admin_organization_assignment",
      args: {
        p_admin_profile_id: adminProfileId,
        p_organization_id: organizationId,
        p_actor_admin_id: actor.userId,
        p_reason: reason,
      },
    },
    REVOKE_HOST_ADMIN_ASSIGNMENT: {
      rpc: "revoke_admin_organization_assignment",
      args: {
        p_admin_profile_id: adminProfileId,
        p_organization_id: organizationId,
        p_actor_admin_id: actor.userId,
        p_reason: reason,
      },
    },
  };
  const request = requests[intent];
  if (
    !request ||
    !adminProfileId ||
    !reason ||
    (request.args.p_organization_id && !organizationId)
  ) {
    return { error: GENERIC_ADMIN_LIFECYCLE_ERROR };
  }

  const { data: changed, error } = await privileged.rpc(request.rpc, request.args as never);
  if (error || !changed) {
    return { error: GENERIC_ADMIN_LIFECYCLE_ERROR };
  }
  revalidatePath("/admin/invitations");
  return {
    success:
      intent === "DEACTIVATE_HOST_ADMIN"
        ? "Host Admin deactivated."
        : intent === "REACTIVATE_HOST_ADMIN"
          ? "Host Admin reactivated."
          : intent === "ADD_HOST_ADMIN_ASSIGNMENT"
            ? "Organization assignment added."
            : "Organization assignment revoked.",
  };
}

export async function acceptInvitation(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token) || !email || password.length < 8 || !displayName) {
    return { error: GENERIC_INVITATION_ERROR };
  }

  const privileged = createPrivilegedClient();
  const sessionClient = await createClient();
  const { data: session } = await sessionClient.auth.getUser();
  if (session.user && session.user.email?.trim().toLowerCase() !== email) {
    return { error: GENERIC_INVITATION_ERROR };
  }
  let authUserId: string;
  let createdAuthUser = false;
  let existingAuthUser = false;
  if (session.user) {
    authUserId = session.user.id;
    existingAuthUser = true;
  } else {
    const { data: created, error: createError } = await privileged.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.user) {
      authUserId = created.user.id;
      createdAuthUser = true;
    } else if (createError) {
      const { data: users } = await privileged.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = users.users.find((user) => user.email?.trim().toLowerCase() === email);
      if (!existing) return { error: GENERIC_INVITATION_ERROR };
      authUserId = existing.id;
      existingAuthUser = true;
    } else {
      return { error: GENERIC_INVITATION_ERROR };
    }
  }

  const { error: acceptanceError } = await privileged.rpc("accept_admin_invitation", {
    p_token_hash: hashInvitationToken(token),
    p_auth_user_id: authUserId,
    p_email: email,
    p_display_name: displayName,
  });
  if (acceptanceError) {
    if (createdAuthUser) await privileged.auth.admin.deleteUser(authUserId);
    return { error: GENERIC_INVITATION_ERROR };
  }

  if (existingAuthUser && !session.user) {
    const { error: passwordError } = await privileged.auth.admin.updateUserById(authUserId, {
      password,
    });
    if (passwordError) return { error: GENERIC_INVITATION_ERROR };
  }

  if (!session.user) {
    const { error: sessionError } = await sessionClient.auth.signInWithPassword({
      email,
      password,
    });
    if (sessionError) {
      return { error: GENERIC_INVITATION_ERROR };
    }
  }
  redirect("/admin");
}
