"use client";

import { useState } from "react";
import {
  Wallet, Banknote, Smartphone, BookText, Boxes,
  Receipt, TrendingUp, RefreshCw, ShoppingBag,
} from "lucide-react";

import { KpiCard } from "./KpiCard";
import { KpiCardSkeleton } from "@/components/ui/skeleton";
import { AlertsPanel } from "./AlertsPanel";
import { SalesVsExpensesChart } from "./SalesVsExpensesChart";
import { TimeFrameFilter, getDateRange, DEFAULT_TIMEFRAME, type TimeFrame, type DateRange } from "./TimeFrameFilter";

import { useDashboardData, type DashboardData } from "@/hooks/useDashboardData";
import { formatINR, formatNumberIN, profitColorClass } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

// ─── Default view ─────────────────────────────────────────────────────────────
// "This Month" is the starting timeframe — a reasonable middle ground between
// "Today" (too little data for a first paint) and "All Time" (the old
// behaviour, but no longer the point of a filterable dashboard).
// DEFAULT_TIMEFRAME lives in TimeFrameFilter.tsx and is imported here AND in
// dashboard/page.tsx's server fetch — change it there (once) if a different
// default is preferred, rather than here, so the two can't drift apart.

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  // Time-frame + custom date range live here, in the client component, so
  // switching presets or applying a custom range doesn't need a full page
  // navigation — just a state update that the hook below reacts to.
  const [frame, setFrame] = useState<TimeFrame>(DEFAULT_TIMEFRAME);
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange(DEFAULT_TIMEFRAME));

  const { data, isLoading, isRefreshing } = useDashboardData(initialData, dateRange);
  const pnl = data.pnl;

  function handleFrameChange(newFrame: TimeFrame, newRange: DateRange) {
    setFrame(newFrame);
    setDateRange(newRange);
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Live Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {frame === "custom"
              ? `${dateRange.from} to ${dateRange.to}`
              : "Updates automatically"}
          </p>
        </div>
        <RefreshCw className={cn("h-4 w-4 text-muted-foreground", (isRefreshing || isLoading) && "animate-spin")} />
      </div>

      {/* Time-frame filter */}
      <TimeFrameFilter value={frame} dateRange={dateRange} onChange={handleFrameChange} />

      {/* Top KPI row — Revenue, Cash, UPI, Orders */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading ? (
          <>
            <KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard label="Gross Revenue" value={formatINR(pnl?.gross_revenue ?? 0)} icon={Wallet} accent="primary" />
            <KpiCard label="Cash Sales" value={formatINR(pnl?.cash ?? 0)} icon={Banknote} accent="primary" />
            <KpiCard label="UPI / Online" value={formatINR(pnl?.upi ?? 0)} icon={Smartphone} accent="secondary" />
            {/* New — Total Orders KPI, count of sale rows in the selected period */}
            <KpiCard
              label="Total Orders"
              value={formatNumberIN(pnl?.sale_count ?? 0)}
              icon={ShoppingBag}
              accent="secondary"
              subtext={frame === "all" ? "All time" : "In selected period"}
            />
          </>
        )}
      </div>

      {/* Profitability row — COGS, Expenses, Net Profit, Active Credit */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading ? (
          <>
            <KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard label="COGS" value={formatINR(pnl?.cogs ?? 0)} icon={Boxes} accent="muted" subtext="Paid purchases" />
            <KpiCard label="Total Expenses" value={formatINR(pnl?.total_expenses ?? 0)} icon={Receipt} accent="destructive" />
            <KpiCard
              label="Net Profit"
              value={formatINR(pnl?.net_profit ?? 0)}
              icon={TrendingUp}
              accent={(pnl?.net_profit ?? 0) >= 0 ? "primary" : "destructive"}
              valueClassName={profitColorClass(pnl?.net_profit ?? 0)}
            />
            {/* Active credit is intentionally always all-time — an outstanding
                balance doesn't belong to any single period */}
            <KpiCard
              label="Active Credit (Udhaar)"
              value={formatINR(pnl?.active_credit ?? 0)}
              icon={BookText}
              accent="warning"
              subtext="All-time outstanding"
            />
          </>
        )}
      </div>

      <SalesVsExpensesChart daily={data.daily} />
      <AlertsPanel alerts={data.alerts} />
    </div>
  );
}
