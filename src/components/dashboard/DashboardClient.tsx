"use client";

import { useState } from "react";
import {
  BookText, Boxes, Receipt, RefreshCw, ShoppingBag, Activity, ArrowUpRight,
} from "lucide-react";

import { KpiCard } from "./KpiCard";
import { KpiCardSkeleton } from "@/components/ui/skeleton";
import { AlertsPanel } from "./AlertsPanel";
import { SalesVsExpensesChart } from "./SalesVsExpensesChart";
import { TimeFrameFilter, getDateRange, DEFAULT_TIMEFRAME, type TimeFrame, type DateRange } from "./TimeFrameFilter";
import { Card, CardContent } from "@/components/ui/card";

import { useDashboardData, type DashboardData } from "@/hooks/useDashboardData";
import { formatINR, formatNumberIN } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const [frame, setFrame] = useState<TimeFrame>(DEFAULT_TIMEFRAME);
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange(DEFAULT_TIMEFRAME));

  const { data, isLoading, isRefreshing } = useDashboardData(initialData, dateRange);
  const pnl = data.pnl;

  function handleFrameChange(newFrame: TimeFrame, newRange: DateRange) {
    setFrame(newFrame);
    setDateRange(newRange);
  }

  // Calculate margin/trend for display purposes in the hero card
  const profitMargin = pnl?.gross_revenue ? ((pnl.net_profit / pnl.gross_revenue) * 100).toFixed(1) : "0.0";
  const isPositive = (pnl?.net_profit ?? 0) >= 0;

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

      {isLoading ? (
        <div className="space-y-6">
          <KpiCardSkeleton /> 
          <div className="grid grid-cols-2 gap-3">
             <KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton />
          </div>
        </div>
      ) : (
        <>
          {/* 1. PREMIUM HERO CARD: Replaces the 4 separate boxes for Profit, Revenue, Cash, and Online */}
          <Card className="relative overflow-hidden border-emerald-900/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 shadow-lg shadow-emerald-900/10 backdrop-blur-xl">
            {/* Abstract Background Glow */}
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-600/10 blur-3xl pointer-events-none" />
            
            <CardContent className="relative flex flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-emerald-400/80">
                  <Activity className="h-4 w-4" /> Net Profit
                </span>
                <div className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                  isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-destructive/10 text-destructive"
                )}>
                  {isPositive && <ArrowUpRight className="h-3 w-3" />}
                  {profitMargin}% Margin
                </div>
              </div>
              
              <div className="mt-4 flex items-baseline gap-2">
                <h2 className={cn(
                  "text-4xl font-bold tracking-tighter tabular-nums sm:text-5xl",
                  isPositive ? "text-white" : "text-destructive"
                )}>
                  {formatINR(pnl?.net_profit ?? 0)}
                </h2>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Gross Revenue</span>
                  <span className="text-base font-semibold tabular-nums text-slate-200 mt-0.5">
                    {formatINR(pnl?.gross_revenue ?? 0)}
                  </span>
                </div>
                
                {/* Payment Split - Inline mini-stats */}
                <div className="flex gap-4 text-right">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Cash</span>
                    <span className="text-xs font-medium tabular-nums text-emerald-300/80 mt-0.5">{formatINR(pnl?.cash ?? 0)}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/10 pl-4">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Online / UPI</span>
                    <span className="text-xs font-medium tabular-nums text-blue-300/80 mt-0.5">{formatINR(pnl?.upi ?? 0)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. SECONDARY METRICS: Compact 2x2 grid for remaining operational numbers */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="COGS" value={formatINR(pnl?.cogs ?? 0)} icon={Boxes} accent="muted" subtext="Paid purchases" />
            <KpiCard label="Total Expenses" value={formatINR(pnl?.total_expenses ?? 0)} icon={Receipt} accent="destructive" />
            
            <KpiCard
              label="Total Orders"
              value={formatNumberIN(pnl?.sale_count ?? 0)}
              icon={ShoppingBag}
              accent="secondary"
              subtext={frame === "all" ? "All time" : "In selected period"}
            />
            
            <KpiCard
              label="Active Credit"
              value={formatINR(pnl?.active_credit ?? 0)}
              icon={BookText}
              accent="warning"
              subtext="All-time outstanding"
            />
          </div>
        </>
      )}

      {/* 3. CHARTS AND ALERTS */}
      <SalesVsExpensesChart daily={data.daily} />
      <AlertsPanel alerts={data.alerts} />
    </div>
  );
}