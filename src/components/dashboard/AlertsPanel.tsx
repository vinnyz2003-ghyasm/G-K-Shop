import { AlertTriangle, PackageX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/database.types";

type AlertRow = Database["public"]["Views"]["v_low_stock_alerts"]["Row"];

export function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageX className="h-4 w-4 text-muted-foreground" />
            Reorder Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Every product is above its reorder level. Nothing needs restocking right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Reorder Alerts
          <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a) => (
          <div
            key={a.product_id}
            className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.category} · {a.product_id}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-destructive tabular-nums">
                {a.current_stock} / {a.reorder_level} {a.unit}
              </p>
              <p className="text-xs text-destructive/80">{a.units_short} {a.unit} short</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
