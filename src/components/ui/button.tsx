import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "icon" | "success" | "destructive";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: ButtonVariant;
};

export function Button({
  className,
  loading = false,
  variant = "primary",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      className={cn("ui-button", `ui-button-${variant}`, loading && "ui-button-loading", className)}
      disabled={disabled || loading}
      {...props}
    />
  );
}

export type { ButtonVariant };
