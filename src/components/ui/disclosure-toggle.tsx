import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export const DisclosureToggle = forwardRef<
  HTMLButtonElement,
  {
    expanded: boolean;
    controls: string;
    children: ReactNode;
    className?: string;
    showIcon?: boolean;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-expanded" | "aria-controls" | "children">
>(function DisclosureToggle(
  { expanded, controls, children, className = "", showIcon = true, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={props.type ?? "button"}
      className={`arakkis-disclosure-toggle ${className}`.trim()}
      aria-expanded={expanded}
      aria-controls={controls}
    >
      {children}
      {showIcon ? (
        <span className="arakkis-disclosure-toggle-icon" aria-hidden="true">
          +
        </span>
      ) : null}
    </button>
  );
});
