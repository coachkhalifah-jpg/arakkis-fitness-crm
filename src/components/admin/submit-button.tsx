"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  disabled = false,
  name,
  value,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name={name} value={value} disabled={pending || disabled}>
      {pending ? "Saving…" : children}
    </Button>
  );
}
