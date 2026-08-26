"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const statuses = [
  ["PENDING", "Open"],
  ["COMPLETED", "Completed"],
  ["DISMISSED", "Dismissed"],
  ["ALL", "All"],
] as const;

type Props = {
  mode: "individual" | "group";
  status: string;
};

export function CommunityStatusNav({ mode, status }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function selectStatus(nextStatus: string) {
    if (nextStatus === status || isPending) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", nextStatus);
    if (mode === "group") params.set("mode", "group");
    else params.delete("mode");
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div className="community-status-filter" role="group" aria-label={`${mode} Community status`}>
      <span>Status</span>
      <div className="community-status-options">
        {statuses.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={status === value ? "is-active" : undefined}
            aria-pressed={status === value}
            disabled={isPending}
            onClick={() => selectStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
