import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-ink shadow-[0_14px_36px_rgba(10,12,15,0.18)]",
        className,
      )}
      {...props}
    />
  );
}
