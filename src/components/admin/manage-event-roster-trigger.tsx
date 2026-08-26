"use client";

import { useCallback, useState } from "react";
import {
  ManageEventRosterDialog,
  type ManageEventRosterDialogProps,
} from "@/components/admin/manage-event-roster-dialog";

type ManageEventRosterTriggerProps = ManageEventRosterDialogProps & {
  label: string;
};

export function ManageEventRosterTrigger({ label, ...dialogProps }: ManageEventRosterTriggerProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        className="admin-manage-event-primary-link"
        onClick={() => setOpen(true)}
      >
        {label} {label === "View attendance" ? null : <span aria-hidden="true">↗</span>}
      </button>
      <ManageEventRosterDialog {...dialogProps} open={open} onClose={close} />
    </>
  );
}
