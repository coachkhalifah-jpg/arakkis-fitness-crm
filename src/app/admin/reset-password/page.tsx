import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="page ops-page ops-auth-page">
      <section className="ops-auth-layout">
        <div className="ops-auth-intro">
          <p className="ops-kicker orange">Arakkis / Admin access</p>
          <h1>
            Set a new
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
          {user ? <PasswordResetForm /> : <PasswordResetRequestForm />}
        </div>
      </section>
    </main>
  );
}
