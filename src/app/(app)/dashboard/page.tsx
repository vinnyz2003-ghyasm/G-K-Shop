import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import type { DashboardData } from "@/hooks/useDashboardData";

export const revalidate = 0; // always fresh — this is a live operational dashboard, not a marketing page

async function getInitialDashboardData(): Promise<DashboardData> {
  const supabase = createServerSupabaseClient();

  const [{ data: pnl }, { data: alerts }, { data: daily }] = await Promise.all([
    supabase.from("v_pnl_summary").select("*").single(),
    supabase.from("v_low_stock_alerts").select("*"),
    supabase.from("v_daily_sales_vs_expenses").select("*"),
  ]);

  return { pnl: pnl ?? null, alerts: alerts ?? [], daily: daily ?? [] };
}

export default async function DashboardPage() {
  const initialData = await getInitialDashboardData();
  return <DashboardClient initialData={initialData} />;
}
