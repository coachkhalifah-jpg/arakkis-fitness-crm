/** One-shot success checkmark for scoped ActionForm success rows (Manage Event update). */
export function ActionFormSuccessCheckmark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="action-form-success-checkmark__circle" cx="16" cy="16" r="16" />
      <path
        className="action-form-success-checkmark__mark"
        d="M9 16l5 5 9-9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
