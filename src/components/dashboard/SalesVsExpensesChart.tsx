"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR, formatNumberIN } from "@/lib/utils/currency";
import { formatDateDisplay } from "@/lib/utils/date";
import type { Database } from "@/lib/supabase/database.types";

type DailyRow = Database["public"]["Views"]["v_daily_sales_vs_expenses"]["Row"];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{formatDateDisplay(label)}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-3" style={{ color: p.fill }}>
          <span>{p.dataKey === "revenue" ? "Sales" : "Expenses"}</span>
          <span className="font-medium">{formatINR(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function SalesVsExpensesChart({ daily }: { daily: DailyRow[] }) {
  // last 14 days is plenty on a phone screen — 30 is fetched, trim for readability
  const data = daily.slice(-14);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Daily Sales vs Expenses</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => d.slice(8, 10)}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatNumberIN(v)}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
            <Bar dataKey="revenue" name="Sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
