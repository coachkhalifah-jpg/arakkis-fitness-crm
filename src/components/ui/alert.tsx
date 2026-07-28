import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      className={cn("rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950", className)}
      {...props}
    />
  );
}
