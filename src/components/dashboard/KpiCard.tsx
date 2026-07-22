import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type Accent = "primary" | "secondary" | "destructive" | "warning" | "muted";

const ACCENT_STYLES: Record<Accent, { icon: string; ring: string }> = {
  primary: { icon: "bg-primary/15 text-primary", ring: "hover:ring-primary/30" },
  secondary: { icon: "bg-secondary/15 text-secondary", ring: "hover:ring-secondary/30" },
  destructive: { icon: "bg-destructive/15 text-destructive", ring: "hover:ring-destructive/30" },
  warning: { icon: "bg-warning/15 text-warning", ring: "hover:ring-warning/30" },
  muted: { icon: "bg-muted text-muted-foreground", ring: "hover:ring-border" },
};

export interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: Accent;
  subtext?: string;
  valueClassName?: string;
}

export function KpiCard({ label, value, icon: Icon, accent = "muted", subtext, valueClassName }: KpiCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <Card className={cn("ring-1 ring-transparent transition-shadow", styles.ring)}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", valueClassName)}>
            {value}
          </p>
          {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      </CardContent>
    </Card>
  );
}
