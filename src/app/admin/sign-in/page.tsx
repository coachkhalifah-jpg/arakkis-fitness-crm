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
    <main className="page ops-page ops-auth-page">
      <section className="ops-auth-layout">
        <div className="ops-auth-intro">
          <p className="ops-kicker orange">Arakkis / Admin access</p>
          <h1>
            Make room
            <br />
            <em>to lead.</em>
          </h1>
          <Link className="ops-auth-return" href="/">
            ← Return to participant site
          </Link>
        </div>
        <div className="ops-auth-card">
          <div className="ops-auth-card-head">
            <span className="ops-label">Secure workspace entry</span>
            <span className="ops-auth-lock" aria-hidden="true">
              ◌
            </span>
          </div>
          <SignInForm next={next} />
        </div>
      </section>
    </main>
  );
}
