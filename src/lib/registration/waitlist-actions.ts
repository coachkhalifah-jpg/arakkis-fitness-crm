"use server";

import { createClient } from "@/lib/db/server";
import { isProductionRegistrationBlocked } from "@/lib/config/env";
import { getPublicEnv } from "@/lib/config/env";
import { canonicalizeContactText, canonicalizeName } from "@/lib/registration/normalization";

export type WaitlistJoinActionState = {
  error?: string;
  fieldErrors?: Partial<Record<"displayName" | "contact" | "eventId", string>>;
  success?: boolean;
  removeUrl?: string;
};

export type WaitlistRemoveActionState = {
  error?: string;
  success?: boolean;
  alreadyRemoved?: boolean;
};

function mapJoinError(message: string | undefined): WaitlistJoinActionState {
  const text = (message ?? "").toLowerCase();
  if (text.includes("already on waitlist")) {
    return { error: "You’re already on the waitlist for this class." };
  }
  if (text.includes("not legally available") || text.includes("legally")) {
    return {
      error: "Interest list is temporarily unavailable while legal approval is pending.",
    };
  }
  if (text.includes("waitlist unavailable") || text.includes("event unavailable")) {
    return { error: "This class is not accepting waitlist interest right now." };
  }
  if (text.includes("invalid waitlist name")) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: { displayName: "Enter your name." },
    };
  }
  if (text.includes("invalid waitlist contact")) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: { contact: "Enter a phone number or email." },
    };
  }
  return { error: "Could not join the waitlist. Please try again." };
}

export async function joinEventWaitlistAction(
  _state: WaitlistJoinActionState,
  form: FormData,
): Promise<WaitlistJoinActionState> {
  if (isProductionRegistrationBlocked()) {
    return {
      error: "Interest list is temporarily unavailable while legal approval is pending.",
    };
  }
  const eventId = String(form.get("eventId") ?? "").trim();
  const displayName = canonicalizeName(String(form.get("displayName") ?? ""));
  const contact = canonicalizeContactText(String(form.get("contact") ?? ""));
  const inviteToken = String(form.get("eventInviteToken") ?? "").trim() || null;
  const fieldErrors: WaitlistJoinActionState["fieldErrors"] = {};
  if (!eventId) fieldErrors.eventId = "Choose a class.";
  if (!displayName) fieldErrors.displayName = "Enter your name.";
  if (!contact) fieldErrors.contact = "Enter a phone number or email.";
  if (Object.keys(fieldErrors).length) {
    return { error: "Please correct the highlighted fields.", fieldErrors };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("join_event_waitlist", {
    p_event_id: eventId,
    p_display_name: displayName,
    p_contact: contact,
    p_invite_token: inviteToken,
  } as never);

  if (error || !data) return mapJoinError(error?.message);

  const result = data as { remove_token?: string };
  if (!result.remove_token) return { error: "Could not join the waitlist. Please try again." };

  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    success: true,
    removeUrl: `${base}/waitlist/remove?token=${encodeURIComponent(result.remove_token)}`,
  };
}

export async function removeEventWaitlistAction(
  _state: WaitlistRemoveActionState,
  form: FormData,
): Promise<WaitlistRemoveActionState> {
  const token = String(form.get("token") ?? "").trim();
  if (!token) return { error: "This waitlist link is no longer available." };

  const db = await createClient();
  const { data, error } = await db.rpc("remove_event_waitlist_entry", {
    p_token: token,
  } as never);
  if (error || !data) {
    return { error: "This waitlist link is no longer available." };
  }
  const result = data as { already_removed?: boolean };
  return { success: true, alreadyRemoved: Boolean(result.already_removed) };
}
