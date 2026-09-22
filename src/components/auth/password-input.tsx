"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

/**
 * Password field with an explicit show/hide control for admin auth forms.
 */
export function PasswordInput({
  label,
  id,
  className,
  ...props
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <label htmlFor={inputId} className={className}>
      {label}
      <span className="ops-auth-password-field">
        <input
          {...props}
          id={inputId}
          type={visible ? "text" : "password"}
          autoComplete={props.autoComplete ?? "current-password"}
        />
        <button
          type="button"
          className="ops-auth-password-toggle"
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
