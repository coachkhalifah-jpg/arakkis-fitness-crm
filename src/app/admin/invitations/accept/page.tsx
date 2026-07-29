import Link from "next/link";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const tokenLooksValid = /^[A-Za-z0-9_-]{32,}$/.test(token);
  return (
    <section className="mx-auto max-w-md px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
        Administrator invitation
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">Accept invitation</h1>
      <p className="mt-4 text-slate-600">
        Use the email address that received this invitation. Assigned role and organizations are
        fixed by the inviter.
      </p>
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {tokenLooksValid ? (
          <AcceptInvitationForm token={token} />
        ) : (
          <p className="text-sm text-red-700" role="alert">
            This invitation is invalid or no longer available.
          </p>
        )}
      </div>
      <Link className="mt-6 inline-block text-sm text-brand underline" href="/admin/sign-in">
        Go to sign in
      </Link>
    </section>
  );
}
