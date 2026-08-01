import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/session-actions";
import { requireActiveAdmin } from "@/lib/authorization/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ContextualBack } from "@/components/admin/contextual-back";
import { adminVisualAssets } from "@/lib/config/admin-visual-assets";

export default async function AdminPage() {
  const admin = await requireActiveAdmin();
  return (
    <section
      className="admin-shell px-5 py-10 sm:px-8 sm:py-16"
      style={{
        backgroundImage: `linear-gradient(rgba(241,241,238,.91), rgba(241,241,238,.97)), url(${adminVisualAssets.pageBackgrounds.workspace})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative mx-auto max-w-6xl pt-8">
        <ContextualBack />
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Operational Workspace
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
              Operational Workspace
            </h1>
            <p className="mt-3 text-slate-600">Your operational workspace is ready.</p>
          </div>
          <Badge>
            {admin.role === "SYSTEM_ADMIN" ? "System administrator" : "Venue administrator"}
          </Badge>
        </div>
        <Alert className="mt-8">Choose an operational area to continue.</Alert>
        <nav className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Operations">
          {admin.role === "SYSTEM_ADMIN" ? (
            <Link
              className="rounded-2xl border border-slate-200 bg-white p-5 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-soft"
              href="/admin/organizations"
            >
              Organizations
            </Link>
          ) : null}
          {admin.role === "SYSTEM_ADMIN" ? (
            <>
              <Link
                className="rounded-2xl border border-slate-200 bg-white p-5 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-soft"
                href="/admin/invitations"
              >
                Invitations
              </Link>
              <Link
                className="rounded-2xl border border-slate-200 bg-white p-5 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-soft"
                href="/admin/participants"
              >
                Participants
              </Link>
              <Link
                className="rounded-lg border border-slate-200 bg-white p-4 font-medium hover:border-brand"
                href="/admin/follow-ups"
              >
                Follow-Ups
              </Link>
            </>
          ) : null}
          <Link
            className="rounded-2xl border border-slate-200 bg-white p-5 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-soft"
            href="/admin/venues"
          >
            Venues
          </Link>
          <Link
            className="rounded-2xl border border-slate-200 bg-white p-5 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-soft"
            href="/admin/events"
          >
            Events
          </Link>
        </nav>
        <Card className="mt-8 max-w-2xl space-y-4 p-6">
          <div>
            <dt className="text-sm text-slate-500">Signed-in identity</dt>
            <dd className="font-medium">{admin.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Resolved role</dt>
            <dd className="font-medium">{admin.role}</dd>
          </div>
          {admin.role === "HOST_ADMIN" ? (
            <div>
              <dt className="text-sm text-slate-500">Assigned organizations</dt>
              <dd className="font-medium">{admin.organizationNames.join(", ")}</dd>
            </div>
          ) : null}
        </Card>
        <form className="mt-6" action={signOut}>
          <Button type="submit">Sign out</Button>
        </form>
      </div>
    </section>
  );
}
