import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/config/env";

const PURPOSE = "EVENT_IMAGE_REPLACEMENT";
export const EVENT_IMAGE_ASSET_TYPE = "EVENT_IMAGE_DESKTOP";
/** Long enough for a manage-Event session; forms also mint a fresh intent on submit. */
const TTL_MS = 60 * 60 * 1000;

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", getServerEnv().SUPABASE_SERVICE_ROLE_KEY)
    .update(payload)
    .digest("base64url");
}

export function createEventImageIntent(
  eventId: string,
  actorId: string,
  assetType = EVENT_IMAGE_ASSET_TYPE,
  now = Date.now(),
) {
  const payload = encode({
    purpose: PURPOSE,
    eventId,
    actorId,
    assetType,
    expiresAt: now + TTL_MS,
  });
  return `${payload}.${sign(payload)}`;
}

export type EventImageIntentFailure =
  "missing" | "malformed" | "signature" | "mismatch" | "expired" | "wrong_asset_type";

export type EventImageIntentCheck = { ok: true } | { ok: false; reason: EventImageIntentFailure };

export function inspectEventImageIntent(
  token: string,
  expectedEventId: string,
  expectedActorId: string,
  expectedAssetType: string,
  now = Date.now(),
): EventImageIntentCheck {
  try {
    if (!token.trim()) return { ok: false, reason: "missing" };
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return { ok: false, reason: "malformed" };
    const expectedSignature = sign(payload);
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return { ok: false, reason: "signature" };
    }
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      purpose?: string;
      eventId?: string;
      actorId?: string;
      assetType?: string;
      expiresAt?: number;
    };
    if (expectedAssetType !== EVENT_IMAGE_ASSET_TYPE || parsed.assetType !== expectedAssetType) {
      return { ok: false, reason: "wrong_asset_type" };
    }
    if (
      parsed.purpose !== PURPOSE ||
      parsed.eventId !== expectedEventId ||
      parsed.actorId !== expectedActorId
    ) {
      return { ok: false, reason: "mismatch" };
    }
    if (typeof parsed.expiresAt !== "number") return { ok: false, reason: "malformed" };
    if (parsed.expiresAt <= now) return { ok: false, reason: "expired" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

export function verifyEventImageIntent(
  token: string,
  expectedEventId: string,
  expectedActorId: string,
  expectedAssetType: string,
  now = Date.now(),
) {
  return inspectEventImageIntent(token, expectedEventId, expectedActorId, expectedAssetType, now)
    .ok;
}

export function eventImageIntentErrorMessage(reason: EventImageIntentFailure) {
  if (reason === "expired") {
    return "This Event image form expired. Refresh the Event and try again.";
  }
  return "This Event image form is invalid or expired. Refresh the Event and try again.";
}

export const eventImageIntentPurpose = PURPOSE;
export const eventImageIntentTtlMs = TTL_MS;
