import { z } from "zod";

export const appEnvironments = ["development", "test", "staging", "production"] as const;
export type AppEnvironment = (typeof appEnvironments)[number];

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a URL"),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_ENV: z.enum(appEnvironments),
  APP_BASE_URL: z.string().url().optional(),
});

function requireSecureHostedUrl(value: string, name: string, appEnv: AppEnvironment) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if ((appEnv === "staging" || appEnv === "production") && !local && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS outside local environments.`);
  }
}

export function getPublicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("Server environment cannot be read in a browser context.");
  }

  const env = serverSchema.parse({
    ...getPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_ENV: process.env.APP_ENV,
    APP_BASE_URL: process.env.APP_BASE_URL,
  });
  const canonicalUrl = env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL;
  requireSecureHostedUrl(canonicalUrl, "APP_BASE_URL", env.APP_ENV);
  requireSecureHostedUrl(env.NEXT_PUBLIC_APP_URL, "NEXT_PUBLIC_APP_URL", env.APP_ENV);
  return env;
}

/** Validate all configuration without returning secret values to callers or logs. */
export function assertRuntimeEnvironment(): void {
  getServerEnv();
}

/** Production registration remains blocked until the database/legal process is approved. */
export function isProductionRegistrationBlocked() {
  const env = process.env.APP_ENV;
  return env === "production";
}
