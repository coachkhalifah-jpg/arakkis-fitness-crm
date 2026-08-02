import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { designAssetPublicUrl } from "@/lib/config/design-assets";
import { DesignAssetUploadForm } from "@/components/admin/design-asset-upload-form";
import { DesignAssetRetireForm } from "@/components/admin/design-asset-retire-form";
import { ContextualBack } from "@/components/admin/contextual-back";

const labels: Record<string, string> = {
  PUBLIC_BACKGROUND_DESKTOP: "Public background · desktop",
  PUBLIC_BACKGROUND_MOBILE: "Public background · mobile",
  EVENT_IMAGE_DESKTOP: "Event image · desktop",
  EVENT_IMAGE_MOBILE: "Event image · mobile",
  CATEGORY_IMAGE: "Category fallback",
};

export default async function DesignAssetsPage() {
  await requireSystemAdmin("/admin/design-assets");
  const db = await createClient();
  const [{ data: events }, { data: assets }] = await Promise.all([
    db
      .from("events")
      .select("id,name")
      .is("archived_at", null)
      .order("starts_at", { ascending: false }),
    db
      .from("design_assets")
      .select(
        "id,asset_type,event_id,category_key,storage_path,original_filename,mime_type,byte_size,alt_text,focal_position,created_at",
      )
      .eq("active", true)
      .order("created_at", { ascending: false }),
  ]);
  const eventNames = new Map((events ?? []).map((event) => [event.id, event.name]));
  return (
    <section className="admin-shell px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative mx-auto max-w-3xl pt-8">
        <ContextualBack href="/admin" label="Operational Workspace" />
        <div className="admin-page-header">
          <h1>Design Assets</h1>
          <p>Manage imagery used by public backgrounds, event pages, and category fallbacks.</p>
        </div>
        <div className="admin-surface mt-8 rounded-3xl p-5 sm:p-7">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold">Upload an asset</h2>
            <p className="mt-1 max-w-2xl text-sm text-admin-text-muted">
              Event-specific images override category and local fallback assets. Upload only
              non-sensitive visual files.
            </p>
          </div>
          <DesignAssetUploadForm
            events={(events ?? []).map((event) => ({ id: event.id, name: event.name }))}
          />
        </div>
        <div className="mt-8">
          <div className="mb-4">
            <p className="admin-eyebrow">Active library</p>
            <h2 className="mt-1 text-2xl font-semibold">Currently in use</h2>
          </div>
          {(assets ?? []).length ? (
            <div className="grid gap-5 md:grid-cols-2">
              {(assets ?? []).map((asset) => (
                <article key={asset.id} className="admin-surface overflow-hidden rounded-3xl">
                  <div
                    className="aspect-[16/8] bg-admin-surface-muted"
                    style={{
                      backgroundImage: `url(${designAssetPublicUrl(asset.storage_path)})`,
                      backgroundPosition: asset.focal_position,
                      backgroundSize: "cover",
                    }}
                    role="img"
                    aria-label={asset.alt_text}
                  />
                  <div className="p-5">
                    <p className="admin-eyebrow">{labels[asset.asset_type] ?? asset.asset_type}</p>
                    <h3 className="mt-1 text-lg font-semibold">
                      {asset.event_id
                        ? (eventNames.get(asset.event_id) ?? "Event")
                        : (asset.category_key ?? "Global")}
                    </h3>
                    <p className="mt-2 text-sm text-admin-text-muted">
                      {asset.original_filename ?? "Uploaded image"} ·{" "}
                      {(asset.byte_size / 1024).toFixed(0)} KiB
                    </p>
                    <div className="mt-4 flex items-start justify-between gap-3">
                      <a
                        href={designAssetPublicUrl(asset.storage_path)}
                        target="_blank"
                        rel="noreferrer"
                        className="admin-secondary-button"
                      >
                        Preview
                      </a>
                      <DesignAssetRetireForm id={asset.id} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-surface rounded-3xl p-6 text-sm text-admin-text-muted">
              No uploaded assets are active yet. The approved local fallbacks remain in use.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
