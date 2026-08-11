import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getDateRange, DEFAULT_TIMEFRAME } from "@/components/dashboard/TimeFrameFilter";
import type { DashboardData, FilteredPnl } from "@/hooks/useDashboardData";

export const revalidate = 0; // Operational dashboard — bypass cache for fresh data

const EMPTY_PNL: FilteredPnl = {
  cash: 0,
  upi: 0,
  credit: 0,
  gross_revenue: 0,
  cogs: 0,
  total_expenses: 0,
  active_credit: 0,
  net_profit: 0,
  sale_count: 0,
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

/**
 * Sanitizes raw database rows into pure plain JavaScript objects,
 * explicitly coercing BigInts and null values to prevent RSC serialization crashes.
 */
function sanitizeRecord<T extends Record<string, any>>(record: T): Record<string, any> {
  const cleanRecord: Record<string, any> = {};
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value === "bigint") {
      cleanRecord[key] = Number(value);
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      cleanRecord[key] = sanitizeRecord(value);
    } else {
      cleanRecord[key] = value;
    }
  }
  return cleanRecord;
}

async function getInitialDashboardData(): Promise<DashboardData> {
  const supabase = createServerSupabaseClient();
  const { from, to } = getDateRange(DEFAULT_TIMEFRAME);

  const [pnlRes, alertsRes, dailyRes] = await Promise.all([
    (supabase.rpc as any)("fn_filtered_pnl", { p_from: from, p_to: to }) as Promise<{
      data: RawPnlRow[] | null;
      error: { message: string } | null;
    }>,
    supabase.from("v_low_stock_alerts").select("*"),
    supabase.from("v_daily_sales_vs_expenses").select("*").order("day", { ascending: true }),
  ]);

  const pnlRow = pnlRes.data?.[0];

  // Coerce all monetary and count values into safe JS Numbers
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

  // Transform database result arrays into sanitized, un-prototyped plain object arrays
  const rawAlerts = alertsRes.data ?? [];
  const rawDaily = dailyRes.data ?? [];

  const safeAlerts = rawAlerts.map((item) => sanitizeRecord(item as Record<string, any>));
  const safeDaily = rawDaily.map((item) => sanitizeRecord(item as Record<string, any>));

  return {
    pnl,
    alerts: safeAlerts as unknown as DashboardData["alerts"],
    daily: safeDaily as unknown as DashboardData["daily"],
  };
}

export default async function DashboardPage() {
  const initialData = await getInitialDashboardData();
  return <DashboardClient initialData={initialData} />;
}