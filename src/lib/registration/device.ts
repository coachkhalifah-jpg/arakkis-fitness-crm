import "server-only";

import { cookies } from "next/headers";
import { createPrivilegedClient } from "@/lib/db/privileged";

export const rememberedDeviceCookie = "fitness_remembered_device";
const cookieMaxAge = 60 * 60 * 24 * 180;

export type RememberedParticipant = {
  device_id: string;
  participant_id: string;
  first_name: string;
  last_name: string;
  display_phone: string;
  email: string | null;
  normalized_phone: string;
  phone_country: string;
  normalized_email: string | null;
  primary_affiliation_organization_id: string | null;
  affiliation_other_text: string | null;
  fitness_experience: string | null;
};

export async function resolveRememberedParticipant(token?: string) {
  const raw = token ?? (await cookies()).get(rememberedDeviceCookie)?.value;
  if (!raw) return null;
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("phase10_resolve_participant_device_token", {
    p_token: raw,
  } as never);
  return error || !data ? null : (data as RememberedParticipant);
}

export async function rememberParticipantFromConfirmation(confirmationToken: string) {
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("phase10_issue_participant_device_token", {
    p_confirmation_token: confirmationToken,
  } as never);
  if (error || !data) return { error: "This confirmation link is no longer available." };
  const result = data as { token: string; first_name: string };
  (await cookies()).set(rememberedDeviceCookie, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/register",
    maxAge: cookieMaxAge,
  });
  return { firstName: result.first_name };
}

export async function forgetRememberedParticipant() {
  const jar = await cookies();
  const token = jar.get(rememberedDeviceCookie)?.value;
  if (token) {
    const db = createPrivilegedClient();
    await db.rpc("phase10_revoke_participant_device", { p_token: token } as never);
  }
  jar.set(rememberedDeviceCookie, "", { httpOnly: true, expires: new Date(0), path: "/register" });
}
