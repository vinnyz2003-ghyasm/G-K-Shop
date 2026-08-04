import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getDateRange, DEFAULT_TIMEFRAME } from "@/components/dashboard/TimeFrameFilter";
import type { DashboardData, FilteredPnl } from "@/hooks/useDashboardData";

export const revalidate = 0; // always fresh — this is a live operational dashboard

const EMPTY_PNL: FilteredPnl = {
  cash: 0, upi: 0, credit: 0, gross_revenue: 0,
  cogs: 0, total_expenses: 0, active_credit: 0,
  net_profit: 0, sale_count: 0,
};

// ─── Server-side initial fetch ───────────────────────────────────────────────
// Mirrors the client-side fetchDashboard() in useDashboardData.ts exactly, but
// runs on the server so the first paint already has real numbers for the
// default range — no loading skeleton flash on first load. Uses
// DEFAULT_TIMEFRAME (not a hardcoded "month") so this can never silently drift
// out of sync with DashboardClient.tsx's own default — useDashboardData's
// mount-time skip only avoids a redundant refetch if these two agree on what
// "the starting range" actually is.
//
// P&L totals come from fn_filtered_pnl (supabase/migrations/0002_filtered_pnl_safe.sql),
// an RPC that aggregates in Postgres — see useDashboardData.ts for why this
// replaced pulling raw rows and summing them here in JS (PostgREST's default
// row cap would silently under-report totals once a range matched more rows
// than that cap).
async function getInitialDashboardData(): Promise<DashboardData> {
  const supabase = createServerSupabaseClient();
  const { from, to } = getDateRange(DEFAULT_TIMEFRAME);

  const [pnlRes, alertsRes, dailyRes] = await Promise.all([
    supabase.rpc("fn_filtered_pnl", { p_from: from, p_to: to }),
    supabase.from("v_low_stock_alerts").select("*"),
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

export default async function DashboardPage() {
  const initialData = await getInitialDashboardData();
  return <DashboardClient initialData={initialData} />;
}
