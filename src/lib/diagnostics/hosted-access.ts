import "server-only";

export type HostedAccessDiagnostic = {
  correlation_id: string;
  boundary?: "registration_submission" | "confirmation_route" | "booking_management";
  outcome_category?:
    "success" | "rpc_failure" | "cookie_failure" | "route_failure" | "data_state_failure";
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

const correlationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[4-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isHostedAccessCorrelationId(value: string | undefined): value is string {
  return Boolean(value && correlationIdPattern.test(value));
}

export function logHostedAccessDiagnostic(event: HostedAccessDiagnostic) {
  console.info("[RC2_HOSTED_ACCESS_DIAGNOSTIC]", event);
}
