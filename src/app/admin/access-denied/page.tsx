import { PublicErrorState } from "@/components/registration/public-error-state";

export default function AccessDeniedPage() {
  return (
    <PublicErrorState
      code="403"
      title="Access denied."
      message="Your account does not have active administrator access."
      actionLabel="Return home"
      actionHref="/"
    />
  );
}
