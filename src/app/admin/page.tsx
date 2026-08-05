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
      className="admin-shell px-4 py-8 sm:px-5 sm:py-10"
      style={{
        backgroundImage: `linear-gradient(rgba(31,34,39,.92), rgba(31,34,39,.97)), url(${adminVisualAssets.pageBackgrounds.workspace})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative mx-auto w-full max-w-[520px] pt-4 sm:pt-6">
        <ContextualBack />
        <div className="admin-page-header">
          <h1>Workspace</h1>
          <p>Your operational workspace is ready.</p>
          <Badge>
            {admin.role === "SYSTEM_ADMIN" ? "System administrator" : "Venue administrator"}
          </Badge>
        </div>
        <Alert className="mt-6">Choose an operational area to continue.</Alert>
        <nav className="mt-5 grid gap-3" aria-label="Operations">
          <Link className="admin-navigation-card" href="/admin/events">
            Events
          </Link>
          {admin.role === "SYSTEM_ADMIN" ? (
            <Link
              className="admin-navigation-card admin-navigation-card-compact"
              href="/admin/follow-ups"
            >
              Follow-Ups
            </Link>
          ) : null}
          <div className="admin-navigation-card">
            <Link
              className="block"
              href={admin.role === "SYSTEM_ADMIN" ? "/admin/organizations" : "/admin/venues"}
            >
              Organizations
            </Link>
            <Link className="mt-2 block text-sm font-semibold text-brand" href="/admin/venues">
              Venues
            </Link>
          </div>
          {admin.role === "SYSTEM_ADMIN" ? (
            <>
              <Link className="admin-navigation-card" href="/admin/invitations">
                Invitations
              </Link>
              <Link className="admin-navigation-card" href="/admin/participants">
                Participants
              </Link>
              <Link className="admin-navigation-card" href="/admin/design-assets">
                Design Assets
              </Link>
            </>
          ) : null}
        </nav>
        <Card className="mt-6 space-y-4 p-5">
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
        <form className="mt-5" action={signOut}>
          <Button type="submit">Sign out</Button>
        </form>
      </div>
    </section>
  );
}
