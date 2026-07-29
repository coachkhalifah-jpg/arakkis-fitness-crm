import { z } from "zod";

export const PUBLIC_SLUG_MAX_LENGTH = 80;
const reservedSlugs = new Set([
  "admin",
  "api",
  "login",
  "register",
  "registration",
  "health",
  "favicon",
]);

export const phase7SlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(PUBLIC_SLUG_MAX_LENGTH)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((value) => !reservedSlugs.has(value), "This public slug is reserved.");

export function normalizePublicSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PUBLIC_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
  return normalized && !reservedSlugs.has(normalized)
    ? normalized
    : `${normalized || "event"}-event`;
}

export function assertPublicSlug(value: string): string {
  return phase7SlugSchema.parse(value);
}

export function resolveCanonicalBaseUrl(input: {
  appEnv: "development" | "test" | "staging" | "production";
  appBaseUrl?: string;
  fallbackUrl?: string;
}): string {
  const configured = input.appBaseUrl?.trim() || input.fallbackUrl?.trim();
  const value =
    configured ||
    (input.appEnv === "development" || input.appEnv === "test" ? "http://localhost:3000" : "");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A valid canonical application URL is required.");
  }
  const local =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (!local && url.protocol !== "https:")
    throw new Error("The canonical application URL must use HTTPS.");
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function canonicalRegistrationUrl(baseUrl: string, slug: string): string {
  return `${resolveCanonicalBaseUrl({ appEnv: "production", appBaseUrl: baseUrl })}/register/${encodeURIComponent(assertPublicSlug(slug))}`;
}

export type AvailabilityState =
  | "NOT_YET_OPEN"
  | "OPEN"
  | "PAUSED"
  | "CLOSED"
  | "FULL"
  | "CANCELLED"
  | "UNPUBLISHED"
  | "UNAVAILABLE"
  | "LEGALLY_BLOCKED";

export function getAvailabilityState(input: {
  published: boolean;
  cancelled: boolean;
  organizationActive: boolean;
  venueActive: boolean;
  opensAt?: Date | string | null;
  closesAt?: Date | string | null;
  paused: boolean;
  activeRegistrations: number;
  capacity: number;
  legallyBlocked: boolean;
  now?: Date;
}): AvailabilityState {
  if (input.legallyBlocked) return "LEGALLY_BLOCKED";
  if (input.cancelled) return "CANCELLED";
  if (!input.published) return "UNPUBLISHED";
  if (!input.organizationActive || !input.venueActive) return "UNAVAILABLE";
  const now = (input.now ?? new Date()).getTime();
  if (input.opensAt && new Date(input.opensAt).getTime() > now) return "NOT_YET_OPEN";
  if (input.closesAt && new Date(input.closesAt).getTime() <= now) return "CLOSED";
  if (input.paused) return "PAUSED";
  if (input.activeRegistrations >= input.capacity) return "FULL";
  return "OPEN";
}
