import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type StorageUploadError = {
  message: string;
  statusCode?: string | number;
  name?: string;
};

const UPLOAD_OPTIONS = {
  cacheControl: "31536000",
  upsert: false,
} as const;

/** Convert a Server Action File into the Buffer body used by the working create-event path. */
export async function designAssetFileBytes(file: File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}

export function mapDesignAssetUploadError(
  error: StorageUploadError,
  subject: "image" | "event image" = "image",
): string {
  const message = error.message.toLowerCase();
  if (
    message.includes("bucket") &&
    (message.includes("not found") || message.includes("not exist"))
  ) {
    return "Image storage is not configured (missing design-assets bucket).";
  }
  if (
    message.includes("row-level security") ||
    message.includes("violates") ||
    message.includes("policy") ||
    message.includes("unauthorized") ||
    message.includes("permission") ||
    message.includes("jwt")
  ) {
    return `The ${subject} could not be uploaded because storage permission was denied.`;
  }
  if (
    message.includes("mime") ||
    message.includes("content type") ||
    message.includes("media type")
  ) {
    return subject === "event image"
      ? "Use a JPEG, PNG, WebP, or SVG event image."
      : "Use a JPEG, PNG, WebP, or SVG image.";
  }
  if (message.includes("maximum") || message.includes("too large") || message.includes("payload")) {
    return subject === "event image"
      ? "Event images must be 5 MiB or smaller."
      : "Images must be 5 MiB or smaller.";
  }
  return `The ${subject} could not be uploaded.`;
}

/**
 * Upload into the public design-assets bucket.
 * Tries the signed-in System Admin session first (matches Storage RLS policies),
 * then the privileged client (BYPASSRLS) so local and hosted grant shapes both work.
 */
export async function uploadDesignAssetObject(
  sessionClient: SupabaseClient,
  privilegedClient: SupabaseClient,
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ error: StorageUploadError | null }> {
  const options = { ...UPLOAD_OPTIONS, contentType };

  const sessionResult = await sessionClient.storage
    .from("design-assets")
    .upload(path, bytes, options);
  if (!sessionResult.error) return { error: null };

  console.error("[design-asset-storage] session upload failed", {
    pathPrefix: path.split("/")[0] ?? path,
    message: sessionResult.error.message,
    statusCode: "statusCode" in sessionResult.error ? sessionResult.error.statusCode : undefined,
  });

  const privilegedResult = await privilegedClient.storage
    .from("design-assets")
    .upload(path, bytes, options);
  if (!privilegedResult.error) return { error: null };

  console.error("[design-asset-storage] privileged upload failed", {
    pathPrefix: path.split("/")[0] ?? path,
    message: privilegedResult.error.message,
    statusCode:
      "statusCode" in privilegedResult.error ? privilegedResult.error.statusCode : undefined,
  });

  return {
    error: {
      message: privilegedResult.error.message,
      statusCode:
        "statusCode" in privilegedResult.error ? privilegedResult.error.statusCode : undefined,
      name: privilegedResult.error.name,
    },
  };
}
