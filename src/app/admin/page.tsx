import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/session-actions";
import { requireActiveAdmin } from "@/lib/authorization/server";

export default async function AdminPage() {
  const admin = await requireActiveAdmin();
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Admin area</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
          Admin access verified
        </h1>
        <Alert className="mt-8">
          Phase 2 authentication and authorization foundation is active. Operational features remain
          deferred.
        </Alert>
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
