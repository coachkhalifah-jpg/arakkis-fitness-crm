"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { createPrivilegedClient } from "@/lib/db/privileged";
import { createClient } from "@/lib/db/server";
import { EVENT_IMAGE_ASSET_TYPE, verifyEventImageIntent } from "@/lib/services/event-image-intent";
import { cleanupStoragePaths } from "@/lib/services/storage-cleanup";
import { runReplacementLifecycle } from "@/lib/services/design-asset-replacement";

const MAX_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] as const;
const assetTypes = [
  "PUBLIC_BACKGROUND_DESKTOP",
  "PUBLIC_BACKGROUND_MOBILE",
  "EVENT_IMAGE_DESKTOP",
  "EVENT_IMAGE_MOBILE",
  "CATEGORY_IMAGE",
] as const;

const inputSchema = z.object({
  assetType: z.enum(assetTypes),
  eventId: z.string().uuid().optional().or(z.literal("")),
  categoryKey: z.string().trim().max(80).optional().or(z.literal("")),
  altText: z.string().trim().min(1).max(240),
  focalPosition: z.enum(["top", "center", "bottom", "left", "right"]),
});

export type DesignAssetActionState = { error?: string; success?: string };

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function extension(file: File) {
  const original = file.name.toLowerCase();
  if (file.type === "image/svg+xml") return ".svg";
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  if (original.endsWith(".jpg") || original.endsWith(".jpeg")) return ".jpg";
  return ".img";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The design asset could not be saved.";
}

export async function uploadDesignAsset(
  _state: DesignAssetActionState,
  form: FormData,
): Promise<DesignAssetActionState> {
  let uploadedPath: string | null = null;
  let insertedAssetId: string | null = null;
  let previousAssetId: string | null = null;
  let previousStoragePath: string | null = null;
  let previousRetired = false;
  let replacementCommitted = false;
  try {
    const admin = await requireSystemAdmin("/admin/design-assets");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
    if (file.size > MAX_BYTES) return { error: "Images must be 5 MiB or smaller." };
    if (!allowedMimeTypes.includes(file.type as (typeof allowedMimeTypes)[number])) {
      return { error: "Use a JPEG, PNG, WebP, or SVG image." };
    }
    const input = inputSchema.parse({
      assetType: text(form, "assetType"),
      eventId: text(form, "eventId"),
      categoryKey: text(form, "categoryKey"),
      altText: text(form, "altText"),
      focalPosition: text(form, "focalPosition") || "center",
    });
    const eventId = input.eventId || null;
    const categoryKey = input.categoryKey || null;
    const eventAsset = input.assetType.startsWith("EVENT_");
    const categoryAsset = input.assetType === "CATEGORY_IMAGE";
    if ((eventAsset && !eventId) || (!eventAsset && eventId)) {
      return { error: "Choose an event only for an event-specific image." };
    }
    if ((categoryAsset && !categoryKey) || (!categoryAsset && categoryKey)) {
      return { error: "Choose a category only for a category fallback image." };
    }
    if (
      text(form, "operation") === "EVENT_IMAGE_REPLACEMENT" &&
      (!eventId ||
        input.assetType !== EVENT_IMAGE_ASSET_TYPE ||
        !verifyEventImageIntent(
          text(form, "eventImageIntent"),
          eventId,
          admin.userId,
          input.assetType,
        ))
    ) {
      return {
        error: "This Event image form is invalid or expired. Refresh the Event and try again.",
      };
    }
    const db = await createClient();
    const storage = createPrivilegedClient();
    if (eventId) {
      const { data: event } = await db.from("events").select("id").eq("id", eventId).maybeSingle();
      if (!event) return { error: "The selected event was not found." };
    }
    if (eventId && input.assetType === "EVENT_IMAGE_DESKTOP") {
      const { data: previousAsset } = await db
        .from("design_assets")
        .select("id,storage_path")
        .match({ event_id: eventId, asset_type: input.assetType, active: true })
        .maybeSingle();
      previousAssetId = previousAsset?.id ?? null;
      previousStoragePath = previousAsset?.storage_path ?? null;
    }
    const path = `${input.assetType.toLowerCase()}/${randomUUID()}${extension(file)}`;
    uploadedPath = path;
    const { error: uploadError } = await storage.storage
      .from("design-assets")
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) throw new Error("The image could not be uploaded.");
    const { data: asset, error: insertError } = await db
      .from("design_assets")
      .insert({
        asset_type: input.assetType,
        event_id: eventId,
        category_key: categoryKey,
        storage_path: path,
        original_filename: file.name.slice(0, 255),
        mime_type: file.type,
        byte_size: file.size,
        alt_text: input.altText,
        focal_position: input.focalPosition,
        active: false,
        created_by_admin_id: admin.userId,
      })
      .select("id")
      .single();
    if (insertError || !asset) throw new Error("The image metadata could not be saved.");
    insertedAssetId = asset.id;
    const { error: auditError } = await db.from("audit_events").insert({
      actor_admin_id: admin.userId,
      action: "DESIGN_ASSET_UPLOADED",
      entity_type: "DESIGN_ASSET",
      entity_id: asset.id,
      new_values: {
        asset_type: input.assetType,
        event_id: eventId,
        category_key: categoryKey,
        mime_type: file.type,
        byte_size: file.size,
      },
    });
    if (auditError) throw new Error("The design asset change could not be recorded.");
    const lifecycle = await runReplacementLifecycle({
      retirePrevious: async () => {
        const { error } = await db
          .from("design_assets")
          .update({
            active: false,
            retired_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .match({
            asset_type: input.assetType,
            ...(eventId ? { event_id: eventId } : {}),
            ...(categoryKey ? { category_key: categoryKey } : {}),
          })
          .eq("active", true)
          .neq("id", asset.id);
        previousRetired = Boolean(previousAssetId);
        return {
          error: error ? { message: "The previous image could not be retired safely." } : null,
        };
      },
      activateNew: async () => {
        const { error } = await db
          .from("design_assets")
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq("id", asset.id)
          .eq("active", false);
        return {
          error: error ? { message: "The new image could not be activated safely." } : null,
        };
      },
      restorePrevious: async () => {
        if (!previousAssetId || !previousRetired) return;
        await db
          .from("design_assets")
          .update({ active: true, retired_at: null, updated_at: new Date().toISOString() })
          .eq("id", previousAssetId);
      },
      deactivateNew: async () => {
        await db
          .from("design_assets")
          .update({
            active: false,
            retired_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", asset.id);
      },
      cleanupNew: async () =>
        cleanupStoragePaths([uploadedPath!], async (paths) => {
          const { error } = await storage.storage.from("design-assets").remove(paths);
          return { error: error ? { message: error.message, statusCode: error.statusCode } : null };
        }),
      cleanupPrevious: async () => {
        if (!previousStoragePath) return { ok: true, attempts: 0, unresolvedPaths: [] };
        const cleanup = await cleanupStoragePaths(
          [previousStoragePath],
          async (paths) => {
            const { error } = await storage.storage.from("design-assets").remove(paths);
            return {
              error: error ? { message: error.message, statusCode: error.statusCode } : null,
            };
          },
          2,
        );
        if (!cleanup.ok)
          console.error("[design-asset-cleanup] unresolved retired Event image", {
            eventId,
            path: previousStoragePath,
            attempts: cleanup.attempts,
            error: cleanup.lastError?.message,
          });
        return cleanup;
      },
      refresh: () => {
        revalidatePath("/admin/design-assets");
        revalidatePath("/events");
        if (eventId) revalidatePath(`/register/${eventId}`);
      },
    });
    replacementCommitted = lifecycle.committed;
    if (!lifecycle.committed) throw new Error(lifecycle.error ?? "The image replacement failed.");
    return {
      success: lifecycle.refreshFailed
        ? "Design asset uploaded and activated. Refresh the page to see it."
        : lifecycle.cleanupDebt
          ? "Design asset uploaded and activated. Previous image cleanup is pending."
          : "Design asset uploaded and activated.",
    };
  } catch (error) {
    if (replacementCommitted) {
      console.error("[design-asset-refresh] replacement committed but refresh failed", error);
      return { success: "Design asset uploaded and activated. Refresh the page to see it." };
    }
    if (previousAssetId && previousRetired) {
      await createClient()
        .then((db) =>
          db
            .from("design_assets")
            .update({ active: true, retired_at: null, updated_at: new Date().toISOString() })
            .eq("id", previousAssetId),
        )
        .catch(() => undefined);
    }
    if (insertedAssetId) {
      await createClient()
        .then((db) =>
          db
            .from("design_assets")
            .update({
              active: false,
              retired_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", insertedAssetId),
        )
        .catch(() => undefined);
    }
    if (uploadedPath)
      await createPrivilegedClient().storage.from("design-assets").remove([uploadedPath]);
    return { error: errorMessage(error) };
  }
}

export async function retireDesignAsset(
  _state: DesignAssetActionState,
  form: FormData,
): Promise<DesignAssetActionState> {
  try {
    const admin = await requireSystemAdmin("/admin/design-assets");
    const id = text(form, "id");
    if (!z.string().uuid().safeParse(id).success) return { error: "Invalid design asset." };
    const db = await createClient();
    const storage = createPrivilegedClient();
    const { data: asset } = await db
      .from("design_assets")
      .select("id,storage_path,asset_type,event_id,category_key,active")
      .eq("id", id)
      .maybeSingle();
    if (!asset || !asset.active) return { error: "That design asset is already inactive." };
    const { error } = await db
      .from("design_assets")
      .update({
        active: false,
        retired_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error("The design asset could not be retired.");
    const { error: auditError } = await db.from("audit_events").insert({
      actor_admin_id: admin.userId,
      action: "DESIGN_ASSET_RETIRED",
      entity_type: "DESIGN_ASSET",
      entity_id: id,
      new_values: { active: false },
    });
    if (auditError) throw new Error("The design asset change could not be recorded.");
    const { error: storageError } = await storage.storage
      .from("design-assets")
      .remove([asset.storage_path]);
    if (storageError)
      return { error: "The asset was retired, but its storage object could not be removed." };
    revalidatePath("/admin/design-assets");
    revalidatePath("/events");
    return { success: "Design asset retired." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
