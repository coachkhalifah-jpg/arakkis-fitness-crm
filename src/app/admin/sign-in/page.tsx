import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeAdminRedirect } from "@/lib/auth/redirects";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeAdminRedirect(params.next);
  return (
    <section className="mx-auto max-w-md px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Admin access</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-4 text-slate-600">Administrator access is invitation-only.</p>
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <SignInForm next={next} />
      </div>
      <Link className="mt-6 inline-block text-sm text-brand underline" href="/">
        Return home
      </Link>
    </section>
  );
}
