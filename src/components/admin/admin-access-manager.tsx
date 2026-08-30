"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { manageAdminAccess, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

type AdminAccessRecord = {
  id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  organizationNames: string[];
  organizationIds: string[];
};

function LifecycleSubmit({
  children,
  variant = "secondary",
}: {
  children: React.ReactNode;
  variant?: "secondary" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Working…" : children}
    </Button>
  );
}

function ReasonField({ label = "Reason" }: { label?: string }) {
  return (
    <label>
      {label}
      <input
        name="reason"
        required
        minLength={1}
        maxLength={500}
        placeholder="Operational reason"
      />
    </label>
  );
}

export function AdminAccessManager({
  admins,
  organizations,
}: {
  admins: AdminAccessRecord[];
  organizations: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(manageAdminAccess, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  const hostAdmins = admins.filter((admin) => admin.role === "HOST_ADMIN");
  const systemAdmins = admins.filter((admin) => admin.role === "SYSTEM_ADMIN");
  return (
    <section className="ops-admin-access" aria-labelledby="admin-access-heading">
      <div className="ops-invitation-history-head">
        <div>
          <p className="ops-kicker orange">Active control</p>
          <h2 id="admin-access-heading">Administrator access</h2>
        </div>
        <span>{hostAdmins.length} Host Admin records</span>
      </div>
      <p className="ops-invitation-form-note">
        Changes take effect on the next request. Deactivation preserves assignment history; revoking
        the last active assignment suspends that Host Admin automatically.
      </p>
      {state.error ? (
        <p className="ops-invitation-message is-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="ops-invitation-message" role="status">
          {state.success}
        </p>
      ) : null}
      <div className="ops-admin-access-list">
        {systemAdmins.map((admin) => (
          <article key={admin.id} className="ops-admin-access-record">
            <p className="ops-invitation-record-role">System Admin</p>
            <h3>{admin.display_name}</h3>
            <p>{admin.email}</p>
            <p className="ops-invitation-record-status">{admin.status}</p>
            <p className="ops-invitation-form-note">System Admin lifecycle is owner-protected.</p>
          </article>
        ))}
        {hostAdmins.map((admin) => {
          const availableOrganizations = organizations.filter(
            (organization) => !admin.organizationIds.includes(organization.id),
          );
          return (
            <article key={admin.id} className="ops-admin-access-record">
              <div>
                <p className="ops-invitation-record-role">Host Admin</p>
                <h3>{admin.display_name}</h3>
                <p>{admin.email}</p>
                <p className="ops-invitation-record-status">{admin.status}</p>
              </div>
              <p className="ops-invitation-record-organization">
                {admin.organizationNames.join(", ") || "No active assignment"}
              </p>
              <div className="ops-admin-access-actions">
                {admin.status === "ACTIVE" || admin.status === "SUSPENDED" ? (
                  <form action={formAction}>
                    <input type="hidden" name="intent" value="DEACTIVATE_HOST_ADMIN" />
                    <input type="hidden" name="adminProfileId" value={admin.id} />
                    <ReasonField />
                    <LifecycleSubmit variant="destructive">Deactivate</LifecycleSubmit>
                  </form>
                ) : null}
                {admin.status === "SUSPENDED" || admin.status === "DEACTIVATED" ? (
                  <form action={formAction}>
                    <input type="hidden" name="intent" value="REACTIVATE_HOST_ADMIN" />
                    <input type="hidden" name="adminProfileId" value={admin.id} />
                    <ReasonField />
                    <LifecycleSubmit>Reactivate</LifecycleSubmit>
                  </form>
                ) : null}
                {availableOrganizations.length > 0 ? (
                  <form action={formAction}>
                    <input type="hidden" name="intent" value="ADD_HOST_ADMIN_ASSIGNMENT" />
                    <input type="hidden" name="adminProfileId" value={admin.id} />
                    <label>
                      Add Organization
                      <select name="organizationId" required defaultValue="">
                        <option value="">Select organization</option>
                        {availableOrganizations.map((organization) => (
                          <option key={organization.id} value={organization.id}>
                            {organization.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <ReasonField />
                    <LifecycleSubmit>Add assignment</LifecycleSubmit>
                  </form>
                ) : null}
                {admin.organizationIds.map((organizationId) => {
                  const organizationName = organizations.find(
                    (item) => item.id === organizationId,
                  )?.name;
                  return (
                    <form key={organizationId} action={formAction}>
                      <input type="hidden" name="intent" value="REVOKE_HOST_ADMIN_ASSIGNMENT" />
                      <input type="hidden" name="adminProfileId" value={admin.id} />
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <span>{organizationName ?? "Unavailable organization"}</span>
                      <ReasonField />
                      <LifecycleSubmit variant="destructive">Revoke assignment</LifecycleSubmit>
                    </form>
                  );
                })}
              </div>
            </article>
          );
        })}
        {!admins.length ? <p>No administrator profiles are available.</p> : null}
      </div>
    </section>
  );
}
