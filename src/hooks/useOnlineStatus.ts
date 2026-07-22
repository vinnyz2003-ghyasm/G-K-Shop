"use client";

import { useEffect, useState } from "react";
import { pendingOutboxCount, flushOutbox } from "@/lib/offline/sync-engine";

export interface SyncResult {
  synced: number;
  failed: number;
  abandoned: number;
  lastRunAt: Date | null;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const refreshCount = () =>
      void pendingOutboxCount().then(setPendingCount);
    refreshCount();

    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      const result = await flushOutbox();
      setLastSyncResult({ ...result, lastRunAt: new Date() });
      const count = await pendingOutboxCount();
      setPendingCount(count);
      setIsSyncing(false);
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const poll = setInterval(refreshCount, 5_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(poll);
    };
  }, []);

  const syncNow = async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    const result = await flushOutbox();
    setLastSyncResult({ ...result, lastRunAt: new Date() });
    setPendingCount(await pendingOutboxCount());
    setIsSyncing(false);
  };

  return { isOnline, pendingCount, isSyncing, syncNow, lastSyncResult };
}
