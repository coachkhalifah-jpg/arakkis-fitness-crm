"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { features } from "@/lib/features";

export type DraftRecoveryOptions<T extends Record<string, unknown>> = {
  storageKey: string;
  enabled?: boolean;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T | null;
};

function subscribeStorageKey(key: string, onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function defaultDeserialize<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Local draft recovery for Create Event (no server autosave).
 * Inactive unless `eventDraftRecovery` is enabled (or `enabled` override is true).
 */
export function useDraftRecovery<T extends Record<string, unknown>>(
  initialValue: T,
  options: DraftRecoveryOptions<T>,
) {
  const active = features.eventDraftRecovery && (options.enabled ?? true);
  const { storageKey, serialize: serializeOption, deserialize: deserializeOption } = options;

  const raw = useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        if (!active || typeof window === "undefined") return () => {};
        return subscribeStorageKey(storageKey, onStoreChange);
      },
      [active, storageKey],
    ),
    useCallback(() => (active ? readStorage(storageKey) : null), [active, storageKey]),
    () => null,
  );

  const storedValue = useMemo(() => {
    if (!raw) return null;
    return (deserializeOption ?? defaultDeserialize<T>)(raw);
  }, [deserializeOption, raw]);

  const [override, setOverride] = useState<T | null>(null);
  const value = override ?? storedValue ?? initialValue;
  const recovered = Boolean(storedValue) && override === null;

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      setOverride((currentOverride) => {
        const current = currentOverride ?? storedValue ?? initialValue;
        const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
        if (active && typeof window !== "undefined") {
          try {
            const payload = serializeOption
              ? serializeOption(resolved)
              : JSON.stringify(resolved);
            window.localStorage.setItem(storageKey, payload);
            window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));
          } catch {
            // Ignore quota / private-mode failures; in-memory override still applies.
          }
        }
        return resolved;
      });
    },
    [active, initialValue, serializeOption, storageKey, storedValue],
  );

  const clearDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(storageKey);
        window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));
      } catch {
        // ignore
      }
    }
    setOverride(null);
  }, [storageKey]);

  const discardRecovery = useCallback(() => {
    clearDraft();
    setOverride(initialValue);
  }, [clearDraft, initialValue]);

  return {
    value,
    setValue,
    recovered,
    hydrated: true,
    clearDraft,
    discardRecovery,
    active,
  };
}
