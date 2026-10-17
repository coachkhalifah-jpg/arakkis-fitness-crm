import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireActiveAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { getServerEnv } from "@/lib/config/env";
import { assertPublicSlug } from "@/lib/services/phase-7";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireActiveAdmin();
  const { id } = await params;
  const db = await createClient();
  const { data: event } = await db
    .from("events")
    .select("id,name,host_organization_id,public_slug,event_series_id,event_series(public_slug)")
    .eq("id", id)
    .maybeSingle();
  const seriesRelation = event?.event_series as
    { public_slug?: string | null } | Array<{ public_slug?: string | null }> | null | undefined;
  const seriesSlug = Array.isArray(seriesRelation)
    ? seriesRelation[0]?.public_slug
    : seriesRelation?.public_slug;
  const slug = event?.public_slug ?? seriesSlug ?? null;
  if (
    !event ||
    (admin.role !== "SYSTEM_ADMIN" &&
      !admin.organizationIds.includes(event.host_organization_id)) ||
    !slug
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const env = getServerEnv();
  const base = (env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL).replace(/\/+$/, "");
  const url = `${base}/register/${encodeURIComponent(assertPublicSlug(slug))}`;
  const png = await QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 1200,
    color: { dark: "#111827", light: "#ffffff" },
  });
  const filename = `${
    event.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "event"
  }-registration-qr.png`;
  return new NextResponse(png as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
