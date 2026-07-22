"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { POSEntryForm } from "@/components/pos/POSEntryForm";
import { formatINR } from "@/lib/utils/currency";
import { todayIST } from "@/lib/utils/date";
import type { Database } from "@/lib/supabase/database.types";

type SaleRow = Database["public"]["Tables"]["sales"]["Row"];

export default function PosPage() {
  const [todaysSales, setTodaysSales] = useState<SaleRow[]>([]);

  const loadToday = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("sales")
      .select("*")
      .eq("sale_date", todayIST())
      .order("created_at", { ascending: false });
    if (data) setTodaysSales(data);
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const todaysTotal = todaysSales.reduce((sum, s) => sum + s.total_revenue, 0);

  return (
    <div className="space-y-6 pb-8">
      <POSEntryForm onSaved={loadToday} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Today&rsquo;s Sales</CardTitle>
          <span className="text-sm font-semibold tabular-nums text-primary">{formatINR(todaysTotal)}</span>
        </CardHeader>
        <CardContent className="space-y-2">
          {todaysSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales logged yet today.</p>
          ) : (
            todaysSales.map((s) => (
              <div key={s.transaction_id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{formatINR(s.total_revenue)}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.entry_mode === "itemized" ? "Itemized" : "EOD summary"}
                    {s.remarks ? ` · ${s.remarks}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Cash {formatINR(s.cash_amount)}</p>
                  <p>UPI {formatINR(s.upi_amount)}</p>
                  {s.credit_amount > 0 && <p>Credit {formatINR(s.credit_amount)}</p>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
