"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Search, CheckCircle, Loader2, Truck, AlertCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/utils/currency";
import { formatDateDisplay, todayIST } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { purchaseSchema, type PurchaseInput } from "@/lib/validations/purchase-expense.schema";
import { submitOrQueue } from "@/lib/offline/sync-engine";
import type { Database } from "@/lib/supabase/database.types";

type Purchase = Database["public"]["Tables"]["purchases"]["Row"];
type Product = Pick<Database["public"]["Tables"]["products"]["Row"], "product_id" | "name" | "unit">;

const EMPTY: PurchaseInput = {
  purchase_date: todayIST(),
  product_id: "",
  supplier_name: "",
  qty: 1,
  unit_cost: 0,
  payment_status: "Pending",
  notes: "",
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Paid" | "Pending">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: prods }] = await Promise.all([
      (supabase.from("purchases") as any).select("*").order("purchase_date", { ascending: false }).order("created_at", { ascending: false }),
      (supabase.from("products") as any).select("product_id, name, unit").eq("is_active", true).order("name"),
    ]);
    setPurchases(p ?? []);
    setProducts(prods ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } =
    useForm<PurchaseInput>({ resolver: zodResolver(purchaseSchema), defaultValues: EMPTY });

  async function onSubmit(values: PurchaseInput) {
    setSaving(true);
    const clientUuid = crypto.randomUUID();
    const result = await submitOrQueue(
      "purchases",
      { ...values, client_uuid: clientUuid, notes: values.notes || null },
      "client_uuid",
      clientUuid
    );
    setSaving(false);
    if (result.status === "synced") {
      toast.success(values.payment_status === "Paid"
        ? "Purchase logged — stock updated automatically"
        : "Purchase logged as Pending (Accounts Payable)");
    } else {
      toast.warning("Saved offline — will sync when back online");
    }
    setModalOpen(false);
    reset(EMPTY);
    void load();
  }

  async function markPaid(purchase_id: string) {
    setMarkingId(purchase_id);
    // cast as any — fixes TypeScript strict generic mismatch on payment_status enum
    const { error } = await (supabase.from("purchases") as any)
      .update({ payment_status: "Paid" })
      .eq("purchase_id", purchase_id);
    setMarkingId(null);
    if (error) toast.error(error.message);
    else toast.success("Marked as Paid — stock incremented");
    void load();
  }

  const productMap = Object.fromEntries(products.map((p) => [p.product_id, p]));

  const filtered = purchases.filter((p) => {
    const prod = productMap[p.product_id];
    const matchQ = !query ||
      (prod?.name ?? "").toLowerCase().includes(query.toLowerCase()) ||
      p.supplier_name.toLowerCase().includes(query.toLowerCase());
    const matchStatus = statusFilter === "all" || p.payment_status === statusFilter;
    return matchQ && matchStatus;
  });

  const totalPending = purchases
    .filter((p) => p.payment_status === "Pending")
    .reduce((s, p) => s + p.total_amount, 0);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Purchases</h1>
          {totalPending > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Accounts Payable: {formatINR(totalPending)} pending
            </p>
          )}
        </div>
        <Button onClick={() => { reset(EMPTY); setModalOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Log Purchase
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Total Purchases", value: purchases.reduce((s, p) => s + p.total_amount, 0), cls: "" },
          { label: "Paid (COGS)", value: purchases.filter((p) => p.payment_status === "Paid").reduce((s, p) => s + p.total_amount, 0), cls: "text-primary" },
          { label: "Pending (AP)", value: totalPending, cls: "text-destructive" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={cn("mt-1 text-xl font-semibold tabular-nums", c.cls)}>{formatINR(c.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search product or supplier…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Truck className="h-8 w-8" />
              <p className="text-sm">No purchases found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium text-right">Qty</th>
                    <th className="px-4 py-3 font-medium text-right">Unit Cost</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const prod = productMap[p.product_id];
                    const isPending = p.payment_status === "Pending";
                    return (
                      <tr key={p.purchase_id} className={cn(
                        "border-b border-border/50 transition-colors",
                        isPending ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/40"
                      )}>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateDisplay(p.purchase_date)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{prod?.name ?? p.product_id}</p>
                          <p className="text-xs text-muted-foreground">{p.product_id}</p>
                        </td>
                        <td className="px-4 py-3">{p.supplier_name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{p.qty} {prod?.unit ?? ""}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatINR(p.unit_cost)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(p.total_amount)}</td>
                        <td className="px-4 py-3 text-center">
                          {isPending
                            ? <Badge variant="destructive">Pending</Badge>
                            : <Badge className="bg-primary/20 text-primary">Paid</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isPending && (
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                              disabled={markingId === p.purchase_id}
                              onClick={() => void markPaid(p.purchase_id)}>
                              {markingId === p.purchase_id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <CheckCircle className="h-3 w-3" />}
                              Mark Paid
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log New Purchase</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" max={todayIST()} {...register("purchase_date")} />
                {errors.purchase_date && <p className="text-xs text-destructive">{errors.purchase_date.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Product *</Label>
                <Select value={watch("product_id")} onValueChange={(v) => setValue("product_id", v, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.product_id} value={p.product_id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.product_id && <p className="text-xs text-destructive">{errors.product_id.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Supplier Name *</Label>
                <Input placeholder="e.g. Anand Distributors" {...register("supplier_name")} />
                {errors.supplier_name && <p className="text-xs text-destructive">{errors.supplier_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input type="number" min="1" {...register("qty")} />
                {errors.qty && <p className="text-xs text-destructive">{errors.qty.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Unit Cost (₹) *</Label>
                <Input type="number" step="0.01" min="0" {...register("unit_cost")} />
                {errors.unit_cost && <p className="text-xs text-destructive">{errors.unit_cost.message}</p>}
              </div>
              <div className="col-span-2 flex justify-between rounded-md bg-muted px-4 py-2 text-xs">
                <span className="text-muted-foreground">Invoice Total</span>
                <span className="font-semibold tabular-nums">
                  {formatINR((Number(watch("qty")) || 0) * (Number(watch("unit_cost")) || 0))}
                </span>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Payment Status *</Label>
                <Select value={watch("payment_status")} onValueChange={(v) => setValue("payment_status", v as any, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid — stock added immediately</SelectItem>
                    <SelectItem value="Pending">Pending — Accounts Payable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} placeholder="Invoice number, batch, etc." {...register("notes")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Log Purchase
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
