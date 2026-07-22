"use client";

import { useEffect } from "react";
import { AppSidebar } from "@/components/shared/AppSidebar";
import { startAutoSync, refreshOfflineCache } from "@/lib/offline/sync-engine";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void refreshOfflineCache();
    return startAutoSync();
  }, []);

  return <AppSidebar>{children}</AppSidebar>;
}
