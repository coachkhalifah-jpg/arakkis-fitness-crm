import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_IMAGE_ASSET_TYPE } from "@/lib/services/event-image-intent";
import {
  mapDesignAssetUploadError,
  uploadDesignAssetObject,
} from "@/lib/services/design-asset-storage";

export type SeriesImageSourceAsset = {
  storage_path: string;
  original_filename: string | null;
  mime_type: string;
  byte_size: number;
  alt_text: string;
  focal_position: string;
  event_id: string;
};

export type SeriesOccurrenceImageCandidate = {
  eventId: string;
  startsAt: string;
  status: string;
  seriesOccurrenceNumber: number | null;
  asset: SeriesImageSourceAsset | null;
};

/** Future non-cancelled occurrences receive series main-image fan-out. */
export function selectFutureNonCancelledOccurrenceIds(
  occurrences: Array<{ id: string; starts_at: string; status: string }>,
  now = new Date(),
) {
  const nowMs = now.getTime();
  return occurrences
    .filter(
      (occurrence) =>
        occurrence.status !== "CANCELLED" && new Date(occurrence.starts_at).getTime() > nowMs,
    )
    .map((occurrence) => occurrence.id);
}

/**
 * Prefer the soonest future non-cancelled occurrence's active image (post-fan-out source of truth).
 * Fall back to the canonical/earliest occurrence image so legacy series still inherit.
 */
export function pickSeriesMainImageSource(candidates: SeriesOccurrenceImageCandidate[]) {
  const withAsset = candidates.filter((candidate) => candidate.asset);
  if (!withAsset.length) return null;
  const nowMs = Date.now();
  const future = withAsset
    .filter(
      (candidate) =>
        candidate.status !== "CANCELLED" && new Date(candidate.startsAt).getTime() > nowMs,
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  if (future[0]?.asset) return future[0].asset;
  const canonical = [...withAsset].sort((a, b) => {
    const aNumber = a.seriesOccurrenceNumber ?? Number.MAX_SAFE_INTEGER;
    const bNumber = b.seriesOccurrenceNumber ?? Number.MAX_SAFE_INTEGER;
    if (aNumber !== bNumber) return aNumber - bNumber;
    const startDelta = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    if (startDelta !== 0) return startDelta;
    return a.eventId.localeCompare(b.eventId);
  });
  return canonical[0]?.asset ?? null;
}

function extensionForMime(mimeType: string, originalFilename: string | null) {
  if (mimeType === "image/svg+xml") return ".svg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  const lower = (originalFilename ?? "").toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ".jpg";
  return ".jpg";
}

async function copyOrUploadDesignAsset(
  sessionClient: SupabaseClient,
  privilegedClient: SupabaseClient,
  sourcePath: string,
  destinationPath: string,
  mimeType: string,
  sourceBytes?: Buffer,
): Promise<{ error: { message: string; statusCode?: string | number } | null }> {
  const copied = await privilegedClient.storage
    .from("design-assets")
    .copy(sourcePath, destinationPath);
  if (!copied.error) return { error: null };

  let bytes = sourceBytes;
  if (!bytes) {
    const downloaded = await privilegedClient.storage.from("design-assets").download(sourcePath);
    if (downloaded.error || !downloaded.data) {
      return {
        error: {
          message: downloaded.error?.message ?? "The series image source could not be read.",
        },
      };
    }
    bytes = Buffer.from(await downloaded.data.arrayBuffer());
  }
  return uploadDesignAssetObject(sessionClient, privilegedClient, destinationPath, bytes, mimeType);
}

/** Resolve the current series main image source for inheritance. */
export async function resolveSeriesMainImageSource(
  db: SupabaseClient,
  seriesId: string,
): Promise<SeriesImageSourceAsset | null> {
  const { data: occurrences } = await db
    .from("events")
    .select("id,starts_at,status,series_occurrence_number")
    .eq("event_series_id", seriesId)
    .order("starts_at", { ascending: true });
  if (!occurrences?.length) return null;

  const eventIds = occurrences.map((occurrence) => occurrence.id);
  const { data: assets } = await db
    .from("design_assets")
    .select(
      "storage_path,original_filename,mime_type,byte_size,alt_text,focal_position,event_id,active",
    )
    .in("event_id", eventIds)
    .eq("asset_type", EVENT_IMAGE_ASSET_TYPE)
    .eq("active", true);
  const assetByEvent = new Map(
    (assets ?? []).map((asset) => [
      asset.event_id as string,
      {
        storage_path: asset.storage_path,
        original_filename: asset.original_filename,
        mime_type: asset.mime_type,
        byte_size: asset.byte_size,
        alt_text: asset.alt_text,
        focal_position: asset.focal_position,
        event_id: asset.event_id as string,
      } satisfies SeriesImageSourceAsset,
    ]),
  );

  return pickSeriesMainImageSource(
    occurrences.map((occurrence) => ({
      eventId: occurrence.id,
      startsAt: occurrence.starts_at,
      status: occurrence.status,
      seriesOccurrenceNumber: occurrence.series_occurrence_number,
      asset: assetByEvent.get(occurrence.id) ?? null,
    })),
  );
}

/**
 * Copy the current series main image onto newly materialized occurrences.
 * Skips occurrences that already have an active EVENT_IMAGE_DESKTOP row.
 */
export async function inheritSeriesMainImageOntoOccurrences(input: {
  sessionClient: SupabaseClient;
  privilegedClient: SupabaseClient;
  seriesId: string;
  occurrenceIds: string[];
  actorAdminId: string;
}): Promise<{ inherited: number; error?: string }> {
  const occurrenceIds = [...new Set(input.occurrenceIds)].filter(Boolean);
  if (!occurrenceIds.length) return { inherited: 0 };

  const source = await resolveSeriesMainImageSource(input.sessionClient, input.seriesId);
  if (!source) return { inherited: 0 };

  const { data: existing } = await input.sessionClient
    .from("design_assets")
    .select("event_id")
    .in("event_id", occurrenceIds)
    .eq("asset_type", EVENT_IMAGE_ASSET_TYPE)
    .eq("active", true);
  const alreadyHave = new Set((existing ?? []).map((row) => row.event_id));
  const targets = occurrenceIds.filter((id) => !alreadyHave.has(id));
  if (!targets.length) return { inherited: 0 };

  const downloaded = await input.privilegedClient.storage
    .from("design-assets")
    .download(source.storage_path);
  if (downloaded.error || !downloaded.data) {
    return {
      inherited: 0,
      error: downloaded.error?.message ?? "The series image source could not be read.",
    };
  }
  const sourceBytes = Buffer.from(await downloaded.data.arrayBuffer());
  const ext = extensionForMime(source.mime_type, source.original_filename);
  let inherited = 0;
  const uploadedPaths: string[] = [];

  try {
    for (const eventId of targets) {
      const path = `event_image_desktop/series-inherit/${input.seriesId}/${eventId}/${randomUUID()}${ext}`;
      const { error: uploadError } = await copyOrUploadDesignAsset(
        input.sessionClient,
        input.privilegedClient,
        source.storage_path,
        path,
        source.mime_type,
        sourceBytes,
      );
      if (uploadError) {
        throw new Error(mapDesignAssetUploadError(uploadError, "event image"));
      }
      uploadedPaths.push(path);
      const { data: asset, error: insertError } = await input.sessionClient
        .from("design_assets")
        .insert({
          asset_type: EVENT_IMAGE_ASSET_TYPE,
          event_id: eventId,
          storage_path: path,
          original_filename: source.original_filename,
          mime_type: source.mime_type,
          byte_size: source.byte_size,
          alt_text: source.alt_text,
          focal_position: source.focal_position || "center",
          active: true,
          created_by_admin_id: input.actorAdminId,
        })
        .select("id")
        .single();
      if (insertError || !asset) {
        throw new Error("The inherited series image metadata could not be saved.");
      }
      await input.sessionClient.from("audit_events").insert({
        actor_admin_id: input.actorAdminId,
        action: "DESIGN_ASSET_UPLOADED",
        entity_type: "DESIGN_ASSET",
        entity_id: asset.id,
        new_values: {
          asset_type: EVENT_IMAGE_ASSET_TYPE,
          event_id: eventId,
          series_id: input.seriesId,
          inherited_from_event_id: source.event_id,
          mime_type: source.mime_type,
          byte_size: source.byte_size,
        },
      });
      inherited += 1;
    }
    return { inherited };
  } catch (error) {
    if (uploadedPaths.length) {
      await input.privilegedClient.storage.from("design-assets").remove(uploadedPaths);
    }
    return {
      inherited: 0,
      error: error instanceof Error ? error.message : "Series image inheritance failed.",
    };
  }
}

/** Upload one file bytes buffer to a unique Event-image path. */
export async function uploadSeriesOccurrenceImageObject(input: {
  sessionClient: SupabaseClient;
  privilegedClient: SupabaseClient;
  seriesId: string;
  eventId: string;
  file: File;
  bytes: Buffer;
}) {
  const path = `event_image_desktop/series-main/${input.seriesId}/${input.eventId}/${randomUUID()}${extensionForMime(input.file.type, input.file.name)}`;
  const { error } = await uploadDesignAssetObject(
    input.sessionClient,
    input.privilegedClient,
    path,
    input.bytes,
    input.file.type,
  );
  return { path, error };
}
