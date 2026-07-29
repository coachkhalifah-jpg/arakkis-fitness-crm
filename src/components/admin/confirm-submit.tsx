"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function ConfirmSubmit({
  children,
  message,
}: {
  children: React.ReactNode;
  message: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? "Working…" : children}
    </Button>
  );
}
