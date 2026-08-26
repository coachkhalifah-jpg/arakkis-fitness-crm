import { PublicErrorState } from "@/components/registration/public-error-state";

export default function NotFound() {
  return (
    <PublicErrorState
      code="404"
      title="This page could not be found."
      message="The requested page does not exist."
      actionLabel="Return home"
      actionHref="/"
    />
  );
}
