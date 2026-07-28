import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark",
        className,
      )}
      {...props}
    />
  );
}
