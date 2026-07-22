"use client";

import { useEffect, useState } from "react";
import {
  Download, Database, Wifi, WifiOff, Loader2,
  CheckCircle, RefreshCw, Info, AlertTriangle, Trash2, ShieldCheck, XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/utils/currency";
import { todayIST } from "@/lib/utils/date";
import {
  getFailedOutboxItems,
  clearAbandonedItems,
  clearAllOutbox,
  testSupabaseConnection,
} from "@/lib/offline/sync-engine";
import { offlineDB } from "@/lib/offline/db";

// ─── CSV helpers ─────────────────────────────────────────────────────────────
function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const EXPORTS = [
  { id: "products",            label: "Inventory / Products",  table: "products",            columns: "product_id,name,upc_barcode,category,unit,cost_price,selling_price,profit_per_unit,margin_percentage,reorder_level,current_stock,is_active,created_at" },
  { id: "sales",               label: "Sales Log",             table: "sales",                columns: "transaction_id,sale_date,entry_mode,cash_amount,upi_amount,credit_amount,total_revenue,remarks,created_at" },
  { id: "sale_items",          label: "Itemized Sale Lines",   table: "sale_items",           columns: "sale_item_id,transaction_id,product_id,qty,unit_price,unit_cost,line_total" },
  { id: "purchases",           label: "Purchases",             table: "purchases",            columns: "purchase_id,purchase_date,product_id,supplier_name,qty,unit_cost,total_amount,payment_status,notes,created_at" },
  { id: "expenses",            label: "Expenses",              table: "expenses",             columns: "expense_id,expense_date,category,description,amount,payment_mode,created_at" },
  { id: "udhaar_transactions", label: "Udhaar Ledger",         table: "udhaar_transactions",  columns: "udhaar_id,customer_id,transaction_id,entry_type,amount,entry_date,notes,created_at" },
  { id: "customers",           label: "Customers",             table: "customers",            columns: "customer_id,name,phone,created_at" },
  { id: "v_customer_balances", label: "Customer Balances",     table: "v_customer_balances",  columns: "customer_id,name,phone,outstanding_balance" },
] as const;

type ConnectionStatus = {
  connected: boolean;
  tablesExist: boolean;
  authenticated: boolean;
  error?: string;
} | null;

export default function SettingsPage() {
  const { isOnline, pendingCount, isSyncing, syncNow, lastSyncResult } = useOnlineStatus();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [failedItems, setFailedItems] = useState<any[]>([]);
  const [loadingFailed, setLoadingFailed] = useState(false);
  const [clearingOutbox, setClearingOutbox] = useState(false);

  // ─── Load failed outbox items on mount ──────────────────────────────────
  useEffect(() => {
    void loadFailedItems();
  }, [pendingCount]);

  async function loadFailedItems() {
    setLoadingFailed(true);
    const items = await getFailedOutboxItems();
    setFailedItems(items);
    setLoadingFailed(false);
  }

  // ─── Supabase connection test ────────────────────────────────────────────
  async function runConnectionTest() {
    setTestingConnection(true);
    const result = await testSupabaseConnection();
    setConnectionStatus(result);
    setTestingConnection(false);

    if (!result.connected) {
      toast.error("Cannot reach Supabase — check your environment variables");
    } else if (!result.tablesExist) {
      toast.error("Tables don't exist — you need to run the SQL migration in Supabase");
    } else if (!result.authenticated) {
      toast.warning("Connected but not logged in — RLS may block writes");
    } else {
      toast.success("Supabase connected and tables verified ✓");
    }
  }

  // ─── Clear outbox ────────────────────────────────────────────────────────
  async function handleClearAbandoned() {
    setClearingOutbox(true);
    const count = await clearAbandonedItems();
    toast.success(`Cleared ${count} abandoned item${count !== 1 ? "s" : ""} from outbox`);
    await loadFailedItems();
    setClearingOutbox(false);
  }

  async function handleClearAll() {
    if (!confirm("Clear ALL items from the outbox including pending ones? This cannot be undone.")) return;
    setClearingOutbox(true);
    const count = await clearAllOutbox();
    toast.success(`Cleared ${count} item${count !== 1 ? "s" : ""} from outbox`);
    await loadFailedItems();
    setClearingOutbox(false);
  }

  // ─── CSV export ─────────────────────────────────────────────────────────
  async function exportTable(id: string, table: string, columns: string) {
    setDownloading(id);
    const supabase = createClient();
    const { data, error } = await supabase.from(table as any).select(columns);
    setDownloading(null);
    if (error || !data) { toast.error(`Export failed: ${error?.message ?? "no data"}`); return; }
    const filename = `gnk-${table}-${todayIST()}.csv`;
    downloadCSV(filename, toCSV(data as Record<string, unknown>[]));
    toast.success(`Downloaded ${filename} (${data.length} rows)`);
  }

  async function exportAll() {
    setDownloading("all");
    const supabase = createClient();
    const allData: string[] = [];
    for (const exp of EXPORTS) {
      const { data } = await supabase.from(exp.table as any).select(exp.columns);
      if (data?.length) {
        allData.push(`# ${exp.label}`);
        allData.push(toCSV(data as Record<string, unknown>[]));
        allData.push("");
      }
    }
    setDownloading(null);
    downloadCSV(`gnk-full-backup-${todayIST()}.csv`, allData.join("\n"));
    toast.success("Full backup downloaded");
  }

  const abandonedCount = failedItems.filter((i) => i.status === "abandoned").length;
  const failedCount = failedItems.filter((i) => i.status === "failed").length;

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      {/* ── Connection & Sync Status ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> Connection & Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Online/Offline + pending */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm">
              {isOnline
                ? <><Wifi className="h-4 w-4 text-primary" /><span className="text-primary font-medium">Online</span></>
                : <><WifiOff className="h-4 w-4 text-destructive" /><span className="text-destructive">Offline</span></>}
            </div>
            {pendingCount > 0 ? (
              <Button size="sm" variant="outline" onClick={() => void syncNow()} disabled={isSyncing} className="gap-1.5">
                {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {isSyncing ? "Syncing…" : `Sync ${pendingCount} pending`}
              </Button>
            ) : (
              <Badge variant="outline" className="gap-1.5 text-primary">
                <CheckCircle className="h-3.5 w-3.5" /> All synced
              </Badge>
            )}
          </div>

          {/* Last sync result */}
          {lastSyncResult && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs space-y-0.5">
              <p className="font-medium text-muted-foreground">Last sync result:</p>
              <p className="text-primary">✓ {lastSyncResult.synced} synced</p>
              {lastSyncResult.failed > 0 && <p className="text-destructive">✗ {lastSyncResult.failed} failed</p>}
              {lastSyncResult.abandoned > 0 && <p className="text-warning">⚠ {lastSyncResult.abandoned} abandoned (too many retries)</p>}
            </div>
          )}

          {/* ── Supabase Connection Test ─────────────────────────────────── */}
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runConnectionTest()}
              disabled={testingConnection}
              className="gap-1.5 w-full"
            >
              {testingConnection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Test Supabase Connection
            </Button>

            {connectionStatus && (
              <div className="rounded-md border border-border p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {connectionStatus.connected
                    ? <CheckCircle className="h-4 w-4 text-primary" />
                    : <XCircle className="h-4 w-4 text-destructive" />}
                  <span>Supabase reachable: <strong>{connectionStatus.connected ? "Yes" : "No"}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  {connectionStatus.tablesExist
                    ? <CheckCircle className="h-4 w-4 text-primary" />
                    : <XCircle className="h-4 w-4 text-destructive" />}
                  <span>Database tables exist: <strong>{connectionStatus.tablesExist ? "Yes" : "No"}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  {connectionStatus.authenticated
                    ? <CheckCircle className="h-4 w-4 text-primary" />
                    : <AlertTriangle className="h-4 w-4 text-warning" />}
                  <span>Authenticated: <strong>{connectionStatus.authenticated ? "Yes" : "No (RLS may block writes)"}</strong></span>
                </div>
                {connectionStatus.error && (
                  <div className="rounded bg-destructive/10 border border-destructive/30 px-3 py-2">
                    <p className="text-xs text-destructive font-medium">Error: {connectionStatus.error}</p>
                    {!connectionStatus.tablesExist && (
                      <p className="text-xs text-muted-foreground mt-1">
                        → Go to Supabase → SQL Editor → run <strong>supabase/migrations/0001_init.sql</strong> from your project folder
                      </p>
                    )}
                    {!connectionStatus.connected && (
                      <p className="text-xs text-muted-foreground mt-1">
                        → Check your <strong>NEXT_PUBLIC_SUPABASE_URL</strong> and <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> in .env.local
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Outbox Inspector ─────────────────────────────────────────── */}
          {(failedCount > 0 || abandonedCount > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                Outbox issues: {failedCount} failed · {abandonedCount} abandoned
              </p>

              <div className="rounded-md border border-border divide-y divide-border max-h-48 overflow-y-auto">
                {failedItems.map((item) => (
                  <div key={item.id} className="px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.table}</span>
                      <Badge variant={item.status === "abandoned" ? "warning" : "destructive"} className="text-xs">
                        {item.status} ({item.attempts} tries)
                      </Badge>
                    </div>
                    {item.last_error && (
                      <p className="text-destructive mt-0.5 truncate">{item.last_error}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                {abandonedCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={clearingOutbox}
                    onClick={() => void handleClearAbandoned()}
                    className="gap-1.5 flex-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear {abandonedCount} abandoned
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={clearingOutbox}
                  onClick={() => void handleClearAll()}
                  className="gap-1.5 flex-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear entire outbox
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Export to CSV ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" /> Export to CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Download any table as a spreadsheet-compatible CSV file. Your data stays yours — export
            at any time, share with an accountant, or open in Excel / Google Sheets.
          </p>
          <Button onClick={() => void exportAll()} disabled={!!downloading} className="w-full gap-2">
            {downloading === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Full Backup (all tables)
          </Button>
          <div className="divide-y divide-border rounded-md border border-border">
            {EXPORTS.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm">{exp.label}</span>
                <Button
                  size="sm" variant="ghost" disabled={!!downloading}
                  onClick={() => void exportTable(exp.id, exp.table, exp.columns)}
                  className="gap-1.5 text-xs"
                >
                  {downloading === exp.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                  CSV
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── About ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" /> About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {[
            ["App", "G&K Shop Tracker"],
            ["Version", "1.0.0"],
            ["Stack", "Next.js 14 · Supabase · Tailwind CSS"],
            ["Offline", "Dexie / IndexedDB outbox — works during outages"],
            ["Currency", "Indian Rupees (₹) with Indian number formatting"],
            ["Timezone", "Asia/Kolkata (IST) — all dates anchored to IST"],
            ["Data", "Hosted on Supabase with Row Level Security enabled"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="font-medium text-foreground">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
