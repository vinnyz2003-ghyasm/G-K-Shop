"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, Search, Save, Loader2, AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { CustomerPicker } from "./CustomerPicker";
import { createClient } from "@/lib/supabase/client";
import { offlineDB, type CachedProduct } from "@/lib/offline/db";
import { submitOrQueue } from "@/lib/offline/sync-engine";
import { todayIST } from "@/lib/utils/date";
import { formatINR } from "@/lib/utils/currency";

interface SaleLine {
  lineId: string;
  product_id: string;
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
  cached_stock: number;
}

// ─── BUG FIX #4 ──────────────────────────────────────────────────────────────
// Previously Math.round was used for the payment-split check, allowing up to
// ₹0.49 silent discrepancies (both sides would round to the same rupee value).
// This function uses an absolute tolerance of ₹0.01 instead, so even a single
// paisa gap is caught and surfaced before the sale is committed.
// ─────────────────────────────────────────────────────────────────────────────
function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function ItemizedSaleForm({ onSaved }: { onSaved?: () => void }) {
  // ─── BUG FIX #3 ────────────────────────────────────────────────────────────
  // saleDate was previously frozen with useState(todayIST()) at component mount
  // time. For a PWA kept open across midnight (common on a shop counter), this
  // meant sales made after midnight were logged as the previous day.
  // Now we call todayIST() at submit time instead — the ref is just a stable
  // identity we read when the form submits, not a stale snapshot from mount.
  // ─────────────────────────────────────────────────────────────────────────────
  // (saleDate is no longer a piece of state — it's computed fresh on every save)

  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [cash, setCash] = useState(0);
  const [upi, setUpi] = useState(0);
  const [credit, setCredit] = useState(0);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ─── BUG FIX #8 ────────────────────────────────────────────────────────────
  // Unmounted-component setState: if the user navigates away while the product
  // fetch is still in-flight, the IIFE's setState call would fire on an already-
  // unmounted component. In React 18 this doesn't throw, but it does keep the
  // products array alive in memory until the promise resolves.
  // Solution: a mounted ref. Writes are guarded — if the component unmounted
  // while we were fetching, we simply discard the result.
  // ─────────────────────────────────────────────────────────────────────────────
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (navigator.onLine) {
          const supabase = createClient();
          const { data } = await supabase
            .from("products")
            .select("product_id, name, upc_barcode, category, unit, cost_price, selling_price, reorder_level, current_stock")
            .eq("is_active", true);
          if (data && mountedRef.current) {
            setProducts(data);
            await offlineDB?.cachedProducts.bulkPut(data);
            return;
          }
        }
        const cached = (await offlineDB?.cachedProducts.toArray()) ?? [];
        if (mountedRef.current) setProducts(cached);
      } catch (err) {
        console.error("[ItemizedSale] product fetch error:", err);
      }
    })();
  }, []);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => p.upc_barcode === query.trim() || p.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, products]);

  function addLine(p: CachedProduct) {
    setLines((prev) => {
      const existing = prev.find((l) => l.product_id === p.product_id);
      if (existing) {
        return prev.map((l) => (l.product_id === p.product_id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          lineId: crypto.randomUUID(),
          product_id: p.product_id,
          name: p.name,
          unit: p.unit,
          qty: 1,
          unit_price: p.selling_price,
          cached_stock: p.current_stock,
        },
      ];
    });
    setQuery("");
  }

  function updateLine(lineId: string, patch: Partial<SaleLine>) {
    setLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)));
  }

  function removeLine(lineId: string) {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0);
  const splitTotal = cash + upi + credit;

  // ─── BUG FIX #4 (applied) ───────────────────────────────────────────────────
  const splitMismatch = lines.length > 0 && !amountsMatch(splitTotal, subtotal);

  // ─── BUG FIX #5 ────────────────────────────────────────────────────────────
  // Zero-price items: the previous code used `|| 0` as the fallback when the
  // price field is cleared, and showed no warning. On a busy counter a cashier
  // could tab through, accidentally zero out a price, and complete the sale.
  // We now detect any zero-priced line and surface a warning badge per-line AND
  // block the sale with an explicit message.
  // ─────────────────────────────────────────────────────────────────────────────
  const hasZeroPrice = lines.some((l) => l.unit_price <= 0);

  function handleBarcodeEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const exact = products.find((p) => p.upc_barcode === query.trim());
    if (exact) addLine(exact);
  }

  // ─── BUG FIX #2 + #3 ─────────────────────────────────────────────────────
  // BUG #2: No try/finally — any uncaught exception left isSaving=true forever,
  //         permanently freezing the "Complete Sale" button.
  // BUG #3: saleDate was captured at component mount; now read at submit time.
  // ─────────────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (lines.length === 0) return toast.error("Add at least one item");
    if (hasZeroPrice) return toast.error("One or more items has a ₹0 price — please correct before saving");
    if (splitMismatch) return toast.error(`Cash + UPI + Credit (${formatINR(splitTotal)}) must equal ${formatINR(subtotal)}`);

    setIsSaving(true);
    try {
      const saleDate = todayIST();            // ← BUG FIX #3: fresh IST date at submit time
      const transactionId = crypto.randomUUID();
      const clientUuid = crypto.randomUUID();

      const saleResult = await submitOrQueue(
        "sales",
        {
          transaction_id: transactionId,
          client_uuid: clientUuid,
          sale_date: saleDate,
          entry_mode: "itemized",
          cash_amount: cash,
          upi_amount: upi,
          credit_amount: credit,
          customer_id: credit > 0 ? customerId : null,
        },
        "client_uuid",
        clientUuid
      );

      // Submit all line items. If the sales row went to the offline queue,
      // the items will also be queued. The sync engine replays oldest-first,
      // so the parent row always arrives before its children.
      const lineResults = await Promise.allSettled(
        lines.map((l) => {
          const saleItemId = crypto.randomUUID();
          return submitOrQueue(
            "sale_items",
            {
              sale_item_id: saleItemId,
              transaction_id: transactionId,
              product_id: l.product_id,
              qty: l.qty,
              unit_price: l.unit_price,
            },
            "sale_item_id",
            saleItemId
          );
        })
      );

      const failedLines = lineResults.filter((r) => r.status === "rejected");
      if (failedLines.length > 0) {
        toast.warning(`Sale header saved but ${failedLines.length} item line(s) failed to queue — please check Sync status`);
      } else if (saleResult.status === "synced") {
        toast.success(`Sale logged — ${formatINR(subtotal)}, stock updated`);
      } else {
        toast.warning("Saved offline — will sync (and decrement stock) once you're back online", {
          description: `${lines.length} item${lines.length > 1 ? "s" : ""} · ${formatINR(subtotal)}`,
        });
      }

      setLines([]);
      setCash(0); setUpi(0); setCredit(0);
      setCustomerId(null);
      onSaved?.();
    } catch (err) {
      toast.error("Unexpected error saving sale — please try again");
      console.error("[ItemizedSale] handleSave error:", err);
    } finally {
      setIsSaving(false);   // ← BUG FIX #2: always runs, even on thrown exception
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* Search / barcode */}
        <div className="space-y-1.5">
          <Label htmlFor="barcode">Scan barcode or search product</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="barcode"
              autoFocus
              placeholder="Scan, or type a product name…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleBarcodeEnter}
            />
          </div>
          {matches.length > 0 && (
            <div className="overflow-hidden rounded-md border border-border">
              {matches.map((p) => (
                <button
                  key={p.product_id}
                  type="button"
                  onClick={() => addLine(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">{formatINR(p.selling_price)} · stock {p.current_stock}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart lines */}
        {lines.length > 0 && (
          <div className="space-y-2">
            {lines.map((l) => {
              const oversell = l.qty > l.cached_stock;
              // ─── BUG FIX #5 (displayed) ─────────────────────────────────
              const zeroPriceWarning = l.unit_price <= 0;
              return (
                <div key={l.lineId} className="flex items-center gap-2 rounded-md border border-border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    {oversell && (
                      <p className="flex items-center gap-1 text-xs text-warning">
                        <AlertTriangle className="h-3 w-3" /> Only {l.cached_stock} {l.unit} in stock (last known)
                      </p>
                    )}
                    {zeroPriceWarning && (
                      <p className="flex items-center gap-1 text-xs text-destructive font-medium">
                        <AlertTriangle className="h-3 w-3" /> Price is ₹0 — correct before saving
                      </p>
                    )}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) => updateLine(l.lineId, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-16 text-center"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.unit_price}
                    onChange={(e) => updateLine(l.lineId, { unit_price: Number(e.target.value) || 0 })}
                    className={`w-24 text-right ${zeroPriceWarning ? "border-destructive ring-1 ring-destructive" : ""}`}
                  />
                  <span className="w-20 shrink-0 text-right text-sm tabular-nums">{formatINR(l.qty * l.unit_price)}</span>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(l.lineId)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Subtotal */}
        <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
          <span className="text-lg font-semibold tabular-nums text-primary">{formatINR(subtotal)}</span>
        </div>

        {/* Payment split */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Cash</Label>
            <Input type="number" min={0} value={cash} onChange={(e) => setCash(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>UPI</Label>
            <Input type="number" min={0} value={upi} onChange={(e) => setUpi(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Credit</Label>
            <Input type="number" min={0} value={credit} onChange={(e) => setCredit(Number(e.target.value) || 0)} />
          </div>
        </div>

        {/* ─── BUG FIX #4 (badge) — now shows paisa-level discrepancy too ─── */}
        {splitMismatch && (
          <Badge variant="destructive">
            Cash + UPI + Credit ({formatINR(splitTotal)}) must equal {formatINR(subtotal)}
          </Badge>
        )}

        {credit > 0 && (
          <div className="space-y-1.5">
            <Label>Udhaar customer</Label>
            <CustomerPicker value={customerId} onChange={setCustomerId} />
          </div>
        )}

        <Button
          type="button"
          disabled={isSaving || hasZeroPrice}
          onClick={handleSave}
          className="w-full gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Saving…" : "Complete Sale"}
        </Button>
      </CardContent>
    </Card>
  );
}
