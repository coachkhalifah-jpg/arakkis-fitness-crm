import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/config/env";

const PURPOSE = "EVENT_IMAGE_REPLACEMENT";
export const EVENT_IMAGE_ASSET_TYPE = "EVENT_IMAGE_DESKTOP";
const TTL_MS = 10 * 60 * 1000;

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

export function verifyEventImageIntent(
  token: string,
  expectedEventId: string,
  expectedActorId: string,
  expectedAssetType: string,
  now = Date.now(),
) {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;
    const expectedSignature = sign(payload);
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      purpose?: string;
      eventId?: string;
      actorId?: string;
      assetType?: string;
      expiresAt?: number;
    };
    return (
      parsed.purpose === PURPOSE &&
      parsed.eventId === expectedEventId &&
      parsed.actorId === expectedActorId &&
      expectedAssetType === EVENT_IMAGE_ASSET_TYPE &&
      parsed.assetType === expectedAssetType &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > now
    );
  } catch {
    return false;
  }
}

export const eventImageIntentPurpose = PURPOSE;
