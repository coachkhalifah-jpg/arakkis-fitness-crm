import Link from "next/link";
import { WaitlistRemoveForm } from "@/components/registration/waitlist-remove-form";
import { PublicErrorState } from "@/components/registration/public-error-state";

export default async function WaitlistRemovePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token || token.trim().length < 32) {
    return (
      <PublicErrorState
        code="CLOSED"
        title="This waitlist link is unavailable."
        message="Use the link from when you joined, or browse events for other classes."
        actionLabel="Browse events"
        actionHref="/events"
      />
    );
  }

  return (
    <section className="booking-environment registration-northstar mx-auto min-h-screen w-full max-w-[520px] px-4 pb-16 pt-12 sm:px-5">
      <WaitlistRemoveForm token={token.trim()} />
      <p className="mt-8 text-center text-sm text-slate-600">
        <Link href="/events" className="underline">
          Browse events
        </Link>
      </p>
    </section>
  );
}
