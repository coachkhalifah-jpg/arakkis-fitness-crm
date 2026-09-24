"use server";

import { revalidatePath } from "next/cache";
import { createPrivilegedClient } from "@/lib/db/privileged";
import { getServerEnv } from "@/lib/config/env";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createInvitationToken } from "@/lib/auth/tokens";

const RECOVERY_TTL_MS = 72 * 60 * 60 * 1000;
const GENERIC_ERROR = "The manage link could not be updated.";

export type ParticipantManageRecoveryActionState = {
  error?: string;
  success?: string;
  manageUrl?: string;
  displayPhone?: string;
};

function manageRecoveryUrl(token: string) {
  const env = getServerEnv();
  const base = env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL;
  return `${base}/manage-bookings/recover?token=${encodeURIComponent(token)}`;
}

export async function issueParticipantManageRecoveryLink(
  participantId: string,
): Promise<ParticipantManageRecoveryActionState> {
  const actor = await requireSystemAdmin(`/admin/participants/${participantId}`);
  if (!/^[0-9a-f-]{36}$/i.test(participantId)) {
    return { error: GENERIC_ERROR };
  }

  const privileged = createPrivilegedClient();
  const { data: participant, error: participantError } = await privileged
    .from("participants")
    .select("id, display_phone, status")
    .eq("id", participantId)
    .maybeSingle();
  if (participantError || !participant || participant.status !== "ACTIVE") {
    return { error: GENERIC_ERROR };
  }

  const { token, tokenHash } = createInvitationToken();
  const expires = new Date(Date.now() + RECOVERY_TTL_MS).toISOString();
  const { data: linkId, error } = await privileged.rpc("issue_participant_manage_recovery_link", {
    p_participant_id: participantId,
    p_token_hash: tokenHash,
    p_token_expires_at: expires,
    p_actor_admin_id: actor.userId,
  } as never);
  if (error || !linkId) return { error: GENERIC_ERROR };

  revalidatePath(`/admin/participants/${participantId}`);
  return {
    manageUrl: manageRecoveryUrl(token),
    displayPhone: participant.display_phone,
    success:
      "Manage link created. Copy now; it will not be shown again. No message is sent automatically.",
  };
}

export async function revokeParticipantManageRecoveryLink(
  participantId: string,
): Promise<ParticipantManageRecoveryActionState> {
  const actor = await requireSystemAdmin(`/admin/participants/${participantId}`);
  if (!/^[0-9a-f-]{36}$/i.test(participantId)) {
    return { error: GENERIC_ERROR };
  }

  const privileged = createPrivilegedClient();
  const { data: revoked, error } = await privileged.rpc("revoke_participant_manage_recovery_link", {
    p_participant_id: participantId,
    p_actor_admin_id: actor.userId,
  } as never);
  if (error) return { error: GENERIC_ERROR };
  if (!revoked) return { error: "There is no active manage link to revoke." };

  revalidatePath(`/admin/participants/${participantId}`);
  return { success: "Manage link revoked." };
}
