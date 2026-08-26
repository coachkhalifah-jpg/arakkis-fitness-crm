"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";

const VenueInventoryDisclosureContext = createContext<boolean | null>(null);
const VenueInventoryDisclosureSetterContext = createContext<((open: boolean) => void) | null>(null);

export function VenueInventoryDisclosure({
  children,
  defaultOpen = true,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <VenueInventoryDisclosureContext.Provider value={open}>
      <VenueInventoryDisclosureSetterContext.Provider value={setOpen}>
        {children}
      </VenueInventoryDisclosureSetterContext.Provider>
    </VenueInventoryDisclosureContext.Provider>
  );
}

export function VenueInventoryDisclosureToggle({ title }: { title: string }) {
  const open = useContext(VenueInventoryDisclosureContext);
  const setOpen = useContext(VenueInventoryDisclosureSetterContext);
  if (open === null || !setOpen) return null;
  return (
    <DisclosureToggle
      className="admin-venues-inventory-toggle"
      expanded={open}
      controls="organization-venues-content"
      onClick={() => setOpen(!open)}
    >
      <span className="admin-venues-inventory-toggle-label">{title}</span>
    </DisclosureToggle>
  );
}

export function VenueInventoryDisclosureContent({ children }: { children: ReactNode }) {
  const open = useContext(VenueInventoryDisclosureContext);
  return (
    <div id="organization-venues-content" className="admin-venues-inventory-content" hidden={!open}>
      {children}
    </div>
  );
}
