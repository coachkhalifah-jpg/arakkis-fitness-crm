"use client";

import { useTransition } from "react";
import { forgetDeviceAction } from "@/lib/registration/device-actions";

export function ForgetDevice() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="mt-2 block text-sm font-semibold text-slate-600 underline underline-offset-4 disabled:opacity-60"
      onClick={() => startTransition(() => void forgetDeviceAction())}
    >
      {pending ? "Forgetting…" : "Forget this device"}
    </button>
  );
}
