import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-[var(--foreground)]",
        className,
      )}
      {...props}
    />
  );
}
