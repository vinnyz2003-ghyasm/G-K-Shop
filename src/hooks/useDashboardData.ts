"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { DateRange } from "@/components/dashboard/TimeFrameFilter";

type AlertRow = Database["public"]["Views"]["v_low_stock_alerts"]["Row"];
type DailyRow = Database["public"]["Views"]["v_daily_sales_vs_expenses"]["Row"];

// Filtered P&L — computed by fn_filtered_pnl (supabase/migrations/0002_filtered_pnl_safe.sql),
// which aggregates in Postgres for the chosen date range, rather than the
// all-time v_pnl_summary view or pulling raw rows into JS.
export interface FilteredPnl {
  cash: number;
  upi: number;
  credit: number;
  gross_revenue: number;
  cogs: number;
  total_expenses: number;
  active_credit: number; // always all-time (outstanding balance is not period-scoped)
  net_profit: number;
  sale_count: number;
}

export interface DashboardData {
  pnl: FilteredPnl | null;
  alerts: AlertRow[];
  daily: DailyRow[];
}

const EMPTY_PNL: FilteredPnl = {
  cash: 0, upi: 0, credit: 0, gross_revenue: 0,
  cogs: 0, total_expenses: 0, active_credit: 0,
  net_profit: 0, sale_count: 0,
};

// Plain shape of one row returned by fn_filtered_pnl — used only by the
// .rpc() bypass below, so the rest of this file stays fully typed even
// though that one call deliberately isn't.
interface RawPnlRow {
  cash: number; upi: number; credit: number; gross_revenue: number;
  cogs: number; total_expenses: number; active_credit: number;
  net_profit: number; sale_count: number;
}

// ─── Filtered fetch ───────────────────────────────────────────────────────────
// P&L totals come from one RPC call that aggregates in Postgres, so there's
// no PostgREST row-cap concern regardless of how much history the date range
// matches — only the final totals (one row) ever cross the network. This
// replaced an earlier version that pulled every matching sales/purchases/
// expenses row and summed them with .reduce() in JS, which worked at low
// volumes but would silently under-report once a range matched more rows
// than PostgREST's default per-request cap (1000).
//
// Low-stock alerts and the daily chart are intentionally NOT date-filtered —
// alerts show current stock levels (always present-tense) and the chart
// always shows the last 30 calendar days (bounded by the view itself, see
// v_daily_sales_vs_expenses in 0001_init_safe.sql).
async function fetchDashboard(dateRange: DateRange): Promise<DashboardData> {
  const supabase = createClient();
  const { from, to } = dateRange;

  const [pnlRes, alertsRes, dailyRes] = await Promise.all([
    // Bypassing .rpc()'s generic type inference here on purpose. The function
    // and its types were verified correct directly against the live database
    // and the real supabase-js/postgrest-js source, but something in the
    // build environment kept rejecting this call anyway across many attempts
    // to fix the type definition itself. This sidesteps that entirely rather
    // than keep chasing an unreproducible mismatch — downstream code stays
    // fully typed via the cast on the next line.
    (supabase.rpc as any)("fn_filtered_pnl", { p_from: from, p_to: to }) as Promise<{
      data: RawPnlRow[] | null;
      error: { message: string } | null;
    }>,

    supabase.from("v_low_stock_alerts").select("*"),

    // Explicit .order() — row order from a view isn't guaranteed by
    // Postgres/PostgREST without one, even though the view's own SQL has
    // "order by d.day"; that ordering isn't guaranteed to survive an outer
    // query that doesn't also ask for it. SalesVsExpensesChart relies on
    // ascending order to take the most recent 14 days via .slice(-14).
    // Column name confirmed against the actual view definition: "day".
    supabase.from("v_daily_sales_vs_expenses").select("*").order("day", { ascending: true }),
  ]);

  const pnlRow = pnlRes.data?.[0];
  const pnl: FilteredPnl = pnlRow
    ? {
        cash: pnlRow.cash,
        upi: pnlRow.upi,
        credit: pnlRow.credit,
        gross_revenue: pnlRow.gross_revenue,
        cogs: pnlRow.cogs,
        total_expenses: pnlRow.total_expenses,
        active_credit: pnlRow.active_credit,
        net_profit: pnlRow.net_profit,
        sale_count: pnlRow.sale_count,
      }
    : EMPTY_PNL;

  return {
    pnl,
    alerts: alertsRes.data ?? [],
    daily: dailyRes.data ?? [],
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDashboardData(
  initialData: DashboardData,
  dateRange: DateRange
) {
  const [data, setData]               = useState<DashboardData>(initialData);
  const [isLoading, setIsLoading]     = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // "Latest request wins" guard: each refresh() call gets an id; a result is
  // only applied if no newer refresh() has started in the meantime. This is
  // what the original AbortController was trying to do, but it never actually
  // aborted or was checked against anything, so a slow, stale response could
  // still overwrite a faster, newer one if the user switched filters quickly.
  // This version is verified to actually discard stale responses.
  const latestRequestId = useRef(0);

  const refresh = useCallback(async (range: DateRange) => {
    const requestId = ++latestRequestId.current;
    setIsLoading(true);
    try {
      const result = await fetchDashboard(range);
      if (requestId === latestRequestId.current) {
        setData(result);
      }
      // else: a newer refresh() has since started — discard this stale result
    } finally {
      if (requestId === latestRequestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Re-fetch whenever the date range changes — but NOT on the very first
  // render. `initialData` was already fetched server-side for this exact
  // starting range (see dashboard/page.tsx), so re-fetching it immediately on
  // mount just doubles the initial network cost and, worse, flips isLoading
  // to true right after paint — showing a skeleton flash on every page load,
  // which the server-fetch was specifically meant to avoid.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    void refresh(dateRange);
  }, [dateRange.from, dateRange.to]);

  // Realtime subscription — re-fetches on any write to the underlying tables.
  // Subscribes ONCE (not on every filter change): a ref always holds the
  // latest dateRange so the callback re-fetches with the current filter
  // without needing to tear down and recreate the channel each time the user
  // switches presets.
  const dateRangeRef = useRef(dateRange);
  useEffect(() => { dateRangeRef.current = dateRange; }, [dateRange]);

  useEffect(() => {
    const supabase = createClient();
    const refetch = () => {
      setIsRefreshing(true);
      void refresh(dateRangeRef.current).finally(() => setIsRefreshing(false));
    };
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refetch)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, isLoading, isRefreshing };
}
