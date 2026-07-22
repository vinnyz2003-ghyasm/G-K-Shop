"use client";

import { Wallet, Banknote, Smartphone, BookText, Boxes, Receipt, TrendingUp, RefreshCw } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { AlertsPanel } from "./AlertsPanel";
import { SalesVsExpensesChart } from "./SalesVsExpensesChart";
import { useDashboardData, type DashboardData } from "@/hooks/useDashboardData";
import { formatINR, profitColorClass } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const { data, isRefreshing } = useDashboardData(initialData);
  const pnl = data.pnl;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Live Dashboard</h1>
          <p className="text-sm text-muted-foreground">All-time totals · updates automatically</p>
        </div>
        <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isRefreshing && "animate-spin")} />
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Gross Revenue" value={formatINR(pnl?.gross_revenue ?? 0)} icon={Wallet} accent="primary" />
        <KpiCard label="Cash Sales" value={formatINR(pnl?.cash ?? 0)} icon={Banknote} accent="primary" />
        <KpiCard label="UPI / Online" value={formatINR(pnl?.upi ?? 0)} icon={Smartphone} accent="secondary" />
        <KpiCard
          label="Active Credit (Udhaar)"
          value={formatINR(pnl?.active_credit ?? 0)}
          icon={BookText}
          accent="warning"
          subtext="Currently outstanding"
        />
      </div>

      {/* Profitability row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="COGS" value={formatINR(pnl?.cogs ?? 0)} icon={Boxes} accent="muted" subtext="Paid purchases" />
        <KpiCard label="Total Expenses" value={formatINR(pnl?.total_expenses ?? 0)} icon={Receipt} accent="destructive" />
        <KpiCard
          label="Net Profit"
          value={formatINR(pnl?.net_profit ?? 0)}
          icon={TrendingUp}
          accent={(pnl?.net_profit ?? 0) >= 0 ? "primary" : "destructive"}
          valueClassName={profitColorClass(pnl?.net_profit ?? 0)}
        />
      </div>

      <SalesVsExpensesChart daily={data.daily} />
      <AlertsPanel alerts={data.alerts} />
    </div>
  );
}
