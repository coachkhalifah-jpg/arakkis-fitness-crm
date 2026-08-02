"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type AdminEventCardRailContextValue = {
  activeEventId: string | null;
  setActiveEventId: (eventId: string | null) => void;
};

const AdminEventCardRailContext = createContext<AdminEventCardRailContextValue | null>(null);

export function AdminEventCardRail({ children }: { children: ReactNode }) {
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  return (
    <AdminEventCardRailContext.Provider value={{ activeEventId, setActiveEventId }}>
      {children}
    </AdminEventCardRailContext.Provider>
  );
}

export function useAdminEventCardRail() {
  return useContext(AdminEventCardRailContext);
}
