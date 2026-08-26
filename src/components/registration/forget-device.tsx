"use client";

import { useTransition } from "react";
import { forgetDeviceAction } from "@/lib/registration/device-actions";

export function ForgetDevice({ onForgot }: { onForgot?: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="mt-2 block text-sm font-semibold text-slate-600 underline underline-offset-4 disabled:opacity-60"
      onClick={() =>
        startTransition(async () => {
          await forgetDeviceAction();
          onForgot?.();
        })
      }
    >
      {pending ? "Forgetting…" : "Forget this device"}
    </button>
  );
}
