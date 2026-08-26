import type { HTMLAttributes } from "react";

export function ArakkisCard({
  interactive = false,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={`confirmation-arakkis-card${interactive ? " confirmation-card-interactive" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
