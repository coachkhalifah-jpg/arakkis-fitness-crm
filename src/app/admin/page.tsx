import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/session-actions";
import { requireActiveAdmin } from "@/lib/authorization/server";
import Link from "next/link";

export default async function AdminPage() {
  const admin = await requireActiveAdmin();
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Admin area</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
          Admin access verified
        </h1>
        <Alert className="mt-8">Choose an operational area to continue.</Alert>
        <nav className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Operations">
          {admin.role === "SYSTEM_ADMIN" ? (
            <Link
              className="rounded-lg border border-slate-200 bg-white p-4 font-medium hover:border-brand"
              href="/admin/organizations"
            >
              Organizations
            </Link>
          ) : null}
          {admin.role === "SYSTEM_ADMIN" ? (
            <>
              <Link
                className="rounded-lg border border-slate-200 bg-white p-4 font-medium hover:border-brand"
                href="/admin/invitations"
              >
                Invitations
              </Link>
              <Link
                className="rounded-lg border border-slate-200 bg-white p-4 font-medium hover:border-brand"
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
            className="rounded-lg border border-slate-200 bg-white p-4 font-medium hover:border-brand"
            href="/admin/venues"
          >
            Venues
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-4 font-medium hover:border-brand"
            href="/admin/events"
          >
            Events
          </Link>
        </nav>
        <dl className="mt-8 space-y-4 rounded-lg border border-slate-200 bg-white p-6">
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
        </dl>
        <form className="mt-6" action={signOut}>
          <Button type="submit">Sign out</Button>
        </form>
      </div>
    </section>
  );
}
