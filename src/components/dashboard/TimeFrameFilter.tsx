"use client";

import { useEffect, useState } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { todayIST } from "@/lib/utils/date";

export type TimeFrame = "today" | "week" | "month" | "year" | "all" | "custom";

export interface DateRange {
  from: string; // YYYY-MM-DD IST
  to: string;   // YYYY-MM-DD IST
}

export interface TimeFrameFilterProps {
  value: TimeFrame;
  dateRange: DateRange;
  onChange: (frame: TimeFrame, range: DateRange) => void;
}

// ─── Date range calculator (IST-anchored) ────────────────────────────────────
// All dates are computed from todayIST() so they match the sale_date / purchase_date
// columns in the DB which are also cast to Asia/Kolkata before storage.
//
// IMPORTANT: this does pure Y/M/D calendar arithmetic and never converts through
// a local Date object + .toISOString(). The previous version constructed a Date
// at IST midnight (`T00:00:00+05:30`), shifted it with getDate()/setDate() (which
// read/write in the RUNTIME'S local timezone, not IST), and then called
// .toISOString() (which converts back to UTC). Since IST midnight is 18:30 UTC
// the *previous* day, that round trip silently returned a date one day earlier
// than intended for "week", "month", and "year" — reproduced and confirmed with
// Node before this fix, in Asia/Kolkata, UTC, and America/Los_Angeles alike.
function parseISODate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function formatISODate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Shifts an ISO date string by N days using a UTC-anchored Date purely as a
// calendar calculator (no timezone offset is ever attached, so there is
// nothing for a UTC conversion to shift by one day).
function shiftISODate(iso: string, days: number): string {
  const { y, m, d } = parseISODate(iso);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return formatISODate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

export function getDateRange(frame: TimeFrame): DateRange {
  const today = todayIST();

  switch (frame) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: shiftISODate(today, -6), to: today };
    case "month": {
      const { y, m } = parseISODate(today);
      return { from: formatISODate(y, m, 1), to: today };
    }
    case "year": {
      const { y } = parseISODate(today);
      return { from: formatISODate(y, 1, 1), to: today };
    }
    case "all":
      return { from: "2000-01-01", to: today };
    default:
      return { from: today, to: today };
  }
}

// Shared so the dashboard's server-rendered initial fetch and the client
// hook can never drift apart on what "the default view" means.
export const DEFAULT_TIMEFRAME: TimeFrame = "month";

const PRESETS: { key: TimeFrame; label: string }[] = [
  { key: "today",  label: "Today"      },
  { key: "week",   label: "Last 7 Days"},
  { key: "month",  label: "This Month" },
  { key: "year",   label: "This Year"  },
  { key: "all",    label: "All Time"   },
  { key: "custom", label: "Custom"     },
];

export function TimeFrameFilter({ value, dateRange, onChange }: TimeFrameFilterProps) {
  const [showCustom, setShowCustom] = useState(value === "custom");
  const [localFrom, setLocalFrom] = useState(dateRange.from);
  const [localTo,   setLocalTo]   = useState(dateRange.to);
  const today = todayIST();

  // Keep the picker's fields in sync with whatever range is actually active,
  // so reopening "Custom" after picking a preset starts from that preset's
  // range rather than a stale value left over from first mount.
  useEffect(() => {
    setLocalFrom(dateRange.from);
    setLocalTo(dateRange.to);
  }, [dateRange.from, dateRange.to]);

  function selectPreset(frame: TimeFrame) {
    if (frame === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(frame, getDateRange(frame));
  }

  function applyCustom() {
    if (localFrom > localTo) return;
    onChange("custom", { from: localFrom, to: localTo });
    setShowCustom(false);
  }

  return (
    <div className="space-y-2">
      {/* Preset pill buttons */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              value === p.key
                ? "border-primary/50 bg-primary/15 text-primary shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {p.key === "custom" && <Calendar className="h-3 w-3" />}
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range picker */}
      {showCustom && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              max={today}
              value={localFrom}
              onChange={(e) => setLocalFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              min={localFrom}
              max={today}
              value={localTo}
              onChange={(e) => setLocalTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={applyCustom}
            disabled={!localFrom || !localTo || localFrom > localTo}
            className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={() => setShowCustom(false)}
            title="Cancel"
            className="h-8 rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {localFrom > localTo && (
            <p className="w-full text-xs text-destructive">From date must be before To date</p>
          )}
        </div>
      )}
    </div>
  );
}
