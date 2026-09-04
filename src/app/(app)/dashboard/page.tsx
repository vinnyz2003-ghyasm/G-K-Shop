import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import type { DashboardData, FilteredPnl } from "@/hooks/useDashboardData";

export const revalidate = 0; // always fresh — this is a live operational dashboard

const EMPTY_PNL: FilteredPnl = {
  cash: 0, upi: 0, credit: 0, gross_revenue: 0,
  cogs: 0, total_expenses: 0, active_credit: 0,
  net_profit: 0, sale_count: 0,
};

interface RawPnlRow {
  cash: number | string | null;
  upi: number | string | null;
  credit: number | string | null;
  gross_revenue: number | string | null;
  cogs: number | string | null;
  total_expenses: number | string | null;
  active_credit: number | string | null;
  net_profit: number | string | null;
  sale_count: number | string | bigint | null;
}

// FIX 1: We calculate the default 30-day range directly on the server to completely 
// avoid importing functions from a "use client" file (which caused the crash).
function getInitialServerDateRange() {
  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 30);
  
  // Format as YYYY-MM-DD
  return {
    from: pastDate.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0]
  };
}

async function getInitialDashboardData(): Promise<DashboardData> {
  const supabase = createServerSupabaseClient();
  const { from, to } = getInitialServerDateRange();

  const [pnlRes, alertsRes, dailyRes] = await Promise.all([
    (supabase.rpc as any)("fn_filtered_pnl", { p_from: from, p_to: to }) as Promise<{
      data: RawPnlRow[] | null;
      error: { message: string } | null;
    }>,
    supabase.from("v_low_stock_alerts").select("*"),
    supabase.from("v_daily_sales_vs_expenses").select("*").order("day", { ascending: true }),
  ]);

  const pnlRow = pnlRes.data?.[0];
  
  // FIX 2: Retain the strict Number() casting to prevent BigInt RSC serialization errors
  const pnl: FilteredPnl = pnlRow
    ? {
        cash: Number(pnlRow.cash ?? 0),
        upi: Number(pnlRow.upi ?? 0),
        credit: Number(pnlRow.credit ?? 0),
        gross_revenue: Number(pnlRow.gross_revenue ?? 0),
        cogs: Number(pnlRow.cogs ?? 0),
        total_expenses: Number(pnlRow.total_expenses ?? 0),
        active_credit: Number(pnlRow.active_credit ?? 0),
        net_profit: Number(pnlRow.net_profit ?? 0),
        sale_count: Number(pnlRow.sale_count ?? 0),
      }
    : EMPTY_PNL;

  // FIX 3: Retain pure JS array mapping to safely bypass Next.js caching layers
  const safeAlerts = (alertsRes.data || []).map((item: any) => ({ ...item }));
  const safeDaily = (dailyRes.data || []).map((item: any) => ({ ...item }));

  return {
    pnl,
    alerts: safeAlerts,
    daily: safeDaily,
  };
}

export default async function DashboardPage() {
  const initialData = await getInitialDashboardData();
  return <DashboardClient initialData={initialData} />;
}