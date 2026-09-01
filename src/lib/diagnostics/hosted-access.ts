import "server-only";

export type HostedAccessDiagnostic = {
  correlation_id: string;
  remember_requested?: boolean;
  device_rpc_attempted?: boolean;
  device_rpc_status?: "success" | "error";
  cookie_set_attempted?: boolean;
  cookie_set_completed?: boolean;
  confirmation_cookie_present?: boolean;
  remember_resolution?: "matched" | "missing" | "invalid" | "expired" | "error";
  participant_match?: boolean;
  booking_rpc_attempted?: boolean;
  booking_rpc_status?: "success" | "not_found" | "invalid" | "expired" | "scope_mismatch" | "error";
  registration_match?: boolean;
  booking_result?: "resolved" | "not_found" | "error";
};

export function logHostedAccessDiagnostic(event: HostedAccessDiagnostic) {
  console.info("[RC2_HOSTED_ACCESS_DIAGNOSTIC]", event);
}
