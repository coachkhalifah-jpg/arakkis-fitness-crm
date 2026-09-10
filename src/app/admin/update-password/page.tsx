import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const invalid = params.error === "invalid";

  return (
    <main className="page ops-page ops-auth-page">
      <section className="ops-auth-layout">
        <div className="ops-auth-intro">
          <p className="ops-kicker orange">Arakkis / Admin access</p>
          <h1>
            Choose a new
            <br />
            <em>password.</em>
          </h1>
          <Link className="ops-auth-return" href="/admin/sign-in">
            ← Return to sign in
          </Link>
        </div>
        <div className="ops-auth-card">
          <div className="ops-auth-card-head">
            <span className="ops-label">Secure password recovery</span>
            <span className="ops-auth-lock" aria-hidden="true">
              ◌
            </span>
          </div>
          {user ? (
            <PasswordResetForm />
          ) : (
            <>
              <p className="ops-auth-copy" role={invalid ? "alert" : undefined}>
                {invalid
                  ? "This recovery link is invalid or expired. Request a new link to continue."
                  : "Open a valid recovery link from your email to set a new password."}
              </p>
              <PasswordResetRequestForm />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
