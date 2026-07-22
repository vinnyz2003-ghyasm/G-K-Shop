"use client";

import { CloudOff, CloudUpload, Cloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineSyncBadge() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOnlineStatus();

  if (isOnline && pendingCount === 0) {
    return (
      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
        <Cloud className="h-3.5 w-3.5" /> All synced
      </Badge>
    );
  }

  if (!isOnline) {
    return (
      <Badge variant="warning" className="gap-1.5">
        <CloudOff className="h-3.5 w-3.5" />
        Offline{pendingCount > 0 ? ` · ${pendingCount} queued` : ""} — sales still save locally
      </Badge>
    );
  }

  // Online, but there's a backlog to push (e.g. just reconnected)
  return (
    <Button size="sm" variant="outline" onClick={() => void syncNow()} disabled={isSyncing} className="gap-1.5">
      {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
      {isSyncing ? "Syncing…" : `Sync ${pendingCount} pending`}
    </Button>
  );
}
