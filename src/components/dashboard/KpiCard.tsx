import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Accent = "primary" | "secondary" | "destructive" | "warning" | "muted";

const ACCENT_MAP: Record<Accent, {
  bg: string; border: string; iconBg: string; iconText: string; valueText: string; glow: string;
}> = {
  primary: {
    bg: "bg-gradient-emerald", border: "border-primary/20",
    iconBg: "bg-primary/20", iconText: "text-primary", valueText: "text-primary",
    glow: "card-glow-emerald",
  },
  secondary: {
    bg: "bg-gradient-indigo", border: "border-secondary/20",
    iconBg: "bg-secondary/20", iconText: "text-secondary", valueText: "text-secondary",
    glow: "card-glow-indigo",
  },
  destructive: {
    bg: "bg-gradient-red", border: "border-destructive/20",
    iconBg: "bg-destructive/20", iconText: "text-destructive", valueText: "text-destructive",
    glow: "card-glow-red",
  },
  warning: {
    bg: "bg-gradient-amber", border: "border-warning/20",
    iconBg: "bg-warning/20", iconText: "text-warning", valueText: "text-warning",
    glow: "card-glow-amber",
  },
  muted: {
    bg: "bg-gradient-muted", border: "border-border",
    iconBg: "bg-muted", iconText: "text-muted-foreground", valueText: "text-foreground",
    glow: "",
  },
};

export interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: Accent;
  subtext?: string;
  valueClassName?: string;
}

export function KpiCard({
  label, value, icon: Icon, accent = "muted", subtext, valueClassName,
}: KpiCardProps) {
  const s = ACCENT_MAP[accent];

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-4 transition-all duration-200",
      "hover:scale-[1.015] hover:shadow-lg",
      s.bg, s.border, s.glow
    )}>
      <div className={cn("absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10", s.iconBg)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={cn("mt-2 text-2xl font-bold tabular-nums tracking-tight", valueClassName ?? s.valueText)}>
            {value}
          </p>
          {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", s.iconBg)}>
          <Icon className={cn("h-5 w-5", s.iconText)} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}
