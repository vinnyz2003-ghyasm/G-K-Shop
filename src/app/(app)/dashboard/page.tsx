import { ArrowUpRight, Wallet, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/utils/currency";

export function DashboardHero({ netProfit = 12450, grossRevenue = 45000, trend = "+12.5%" }) {
  return (
    <div className="mb-6 space-y-4">
      {/* Primary Hero Card */}
      <Card className="relative overflow-hidden border-emerald-900/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 shadow-lg shadow-emerald-900/10 backdrop-blur-xl">
        {/* Abstract Background Elements */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-600/10 blur-3xl" />
        
        <CardContent className="relative flex flex-col p-6">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-emerald-400/80">
              <Activity className="h-4 w-4" /> Net Profit
            </span>
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
              <ArrowUpRight className="h-3 w-3" />
              {trend}
            </div>
          </div>
          
          <div className="mt-4 flex items-baseline gap-2">
            <h2 className="text-4xl font-bold tracking-tighter text-white tabular-nums sm:text-5xl">
              {formatINR(netProfit)}
            </h2>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Gross Revenue</span>
              <span className="text-sm font-medium tabular-nums text-slate-300">
                {formatINR(grossRevenue)}
              </span>
            </div>
            
            {/* Payment Split - Inline mini-stats */}
            <div className="flex gap-4 text-right">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-muted-foreground">Cash</span>
                <span className="text-xs font-medium tabular-nums text-emerald-200">₹8,000</span>
              </div>
              <div className="flex flex-col border-l border-white/10 pl-4">
                <span className="text-[10px] uppercase text-muted-foreground">Online</span>
                <span className="text-xs font-medium tabular-nums text-blue-300">₹37,000</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}