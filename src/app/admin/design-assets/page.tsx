import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { designAssetPublicUrl } from "@/lib/config/design-assets";
import { DesignAssetUploadForm } from "@/components/admin/design-asset-upload-form";
import { DesignAssetRetireForm } from "@/components/admin/design-asset-retire-form";
import { ContextualBack } from "@/components/admin/contextual-back";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { signOut } from "@/lib/auth/session-actions";

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
    <>
      <AdminWorkspaceMenu
        roleLabel="System Admin"
        scopeLabel="All organizations"
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems()}
      />
      <section className="admin-shell design-assets-page">
        <div className="design-assets-frame">
          <ContextualBack href="/admin" label="Operational Workspace" />
          <header className="design-assets-hero">
            <p className="design-assets-kicker">System Admin / Visual Library</p>
            <h1>
              Design
              <br />
              Assets
            </h1>
            <p className="design-assets-lede">
              Shape the visual language of every public background, Event page, and category
              fallback.
            </p>
          </header>
          <section
            className="design-assets-upload-card"
            aria-labelledby="design-assets-upload-title"
          >
            <div className="design-assets-section-head">
              <p className="design-assets-kicker">01 / New asset</p>
              <h2 id="design-assets-upload-title">Load the next image.</h2>
              <p>
                Event-specific images override category and local fallback assets. Upload only
                non-sensitive visual files.
              </p>
            </div>
            <DesignAssetUploadForm
              events={(events ?? []).map((event) => ({ id: event.id, name: event.name }))}
            />
          </section>
          <section className="design-assets-library" aria-labelledby="design-assets-library-title">
            <div className="design-assets-section-head design-assets-library-head">
              <div>
                <p className="design-assets-kicker">02 / Active library</p>
                <h2 id="design-assets-library-title">Currently in use</h2>
              </div>
              <span>{(assets ?? []).length} active</span>
            </div>
            {(assets ?? []).length ? (
              <div className="design-assets-grid">
                {(assets ?? []).map((asset) => (
                  <article key={asset.id} className="design-asset-card">
                    <div
                      className="design-asset-preview"
                      style={{
                        backgroundImage: `url(${designAssetPublicUrl(asset.storage_path)})`,
                        backgroundPosition: asset.focal_position,
                        backgroundSize: "cover",
                      }}
                      role="img"
                      aria-label={asset.alt_text}
                    />
                    <div className="design-asset-card-body">
                      <p className="design-assets-meta">
                        {labels[asset.asset_type] ?? asset.asset_type}
                      </p>
                      <h3>
                        {asset.event_id
                          ? (eventNames.get(asset.event_id) ?? "Event")
                          : (asset.category_key ?? "Global")}
                      </h3>
                      <p className="design-assets-file-meta">
                        {asset.original_filename ?? "Uploaded image"} ·{" "}
                        {(asset.byte_size / 1024).toFixed(0)} KiB
                      </p>
                      <div className="design-asset-actions">
                        <a
                          href={designAssetPublicUrl(asset.storage_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="design-assets-secondary-button"
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
              <div className="design-assets-empty">
                No uploaded assets are active yet. The approved local fallbacks remain in use.
              </div>
            )}
          </section>
        </div>
      </section>
    </>
  );
}
