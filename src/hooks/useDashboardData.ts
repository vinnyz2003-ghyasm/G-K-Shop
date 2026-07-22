"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type PnlRow = Database["public"]["Views"]["v_pnl_summary"]["Row"];
type AlertRow = Database["public"]["Views"]["v_low_stock_alerts"]["Row"];
type DailyRow = Database["public"]["Views"]["v_daily_sales_vs_expenses"]["Row"];

export interface DashboardData {
  pnl: PnlRow | null;
  alerts: AlertRow[];
  daily: DailyRow[];
}

async function fetchDashboard(): Promise<DashboardData> {
  const supabase = createClient();

  const [{ data: pnl }, { data: alerts }, { data: daily }] = await Promise.all([
    supabase.from("v_pnl_summary").select("*").single(),
    supabase.from("v_low_stock_alerts").select("*"),
    supabase.from("v_daily_sales_vs_expenses").select("*"),
  ]);

  return { pnl: pnl ?? null, alerts: alerts ?? [], daily: daily ?? [] };
}

/**
 * `initialData` comes from the server component's first render (fast,
 * no loading spinner on a slow shop-counter connection). After that,
 * a Realtime subscription on the underlying tables triggers a
 * refetch — so a sale rung up on the POS screen updates the KPI
 * cards here without a manual page reload.
 */
export function useDashboardData(initialData: DashboardData) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setData(await fetchDashboard());
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { data, isRefreshing, refresh };
}
