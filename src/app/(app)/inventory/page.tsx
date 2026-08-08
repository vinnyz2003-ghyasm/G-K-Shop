"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle, Loader2, PackageSearch, Trash2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";

import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import {
  productSchema, type ProductInput, CATEGORIES, UNITS,
} from "@/lib/validations/product.schema";
import type { Database } from "@/lib/supabase/database.types";

type Product = Database["public"]["Tables"]["products"]["Row"];

const EMPTY: ProductInput = {
  product_id: "", name: "", upc_barcode: "", category: "", unit: "Pc",
  cost_price: 0, selling_price: 0, reorder_level: 10, current_stock: 0, is_active: true,
};

function StockBadge({ current, reorder }: { current: number; reorder: number }) {
  if (current <= 0)
    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Out</Badge>;
  if (current <= reorder)
    return <Badge variant="outline" className="gap-1 border-warning/40 bg-warning/10 text-warning"><AlertTriangle className="h-3 w-3" />Low</Badge>;
  return <Badge variant="default" className="gap-1 bg-primary/20 text-primary"><CheckCircle className="h-3 w-3" />OK</Badge>;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Delete flow state ──────────────────────────────────────────────────────
  // deleteTarget holds the product currently staged for deletion (drives the
  // confirmation modal). deletingId tracks which row's delete request is
  // in flight, so only that row's button shows a spinner.
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("products") as any).select("*").order("name");
    setProducts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors },
  } = useForm<ProductInput>({ resolver: zodResolver(productSchema), defaultValues: EMPTY });

  function openAdd() {
    reset(EMPTY);
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    reset({
      product_id: p.product_id,
      name: p.name,
      upc_barcode: p.upc_barcode ?? "",
      category: p.category,
      unit: p.unit,
      cost_price: p.cost_price,
      selling_price: p.selling_price,
      reorder_level: p.reorder_level,
      current_stock: p.current_stock,
      is_active: p.is_active,
    });
    setEditing(p);
    setModalOpen(true);
  }

  async function onSubmit(values: ProductInput) {
    setSaving(true);
    const payload = { ...values, upc_barcode: values.upc_barcode || null };

    const { data, error } = editing
      ? await (supabase.from("products") as any).update(payload).eq("product_id", editing.product_id).select().single()
      : await (supabase.from("products") as any).insert(payload).select().single();

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Update local state directly instead of a full reload — keeps the table
    // responsive and matches the "no refresh needed" pattern used for delete.
    if (editing) {
      setProducts((prev) => prev.map((p) => (p.product_id === editing.product_id ? data : p)));
      toast.success("Product updated");
    } else {
      setProducts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success("Product added");
    }
    setModalOpen(false);
  }

  async function toggleActive(p: Product) {
    const { error } = await (supabase.from("products") as any)
      .update({ is_active: !p.is_active })
      .eq("product_id", p.product_id);
    if (error) { toast.error(error.message); return; }
    setProducts((prev) => prev.map((x) => (x.product_id === p.product_id ? { ...x, is_active: !x.is_active } : x)));
    toast.success(p.is_active ? "Product deactivated" : "Product reactivated");
  }

  // ── Delete handlers ─────────────────────────────────────────────────────────
  // Step 1: row's trash icon → stage the product and open the shared modal.
  function requestDelete(p: Product) {
    setDeleteTarget(p);
  }

  // Step 2: modal confirm → call Supabase, then update local state so the row
  // disappears instantly. No full-page reload or refetch is needed for this
  // to reflect everywhere the products list is rendered on this page.
  //
  // NOTE ON OFFLINE: unlike Sales/Purchases/Expenses, Products was never
  // wired into the offline outbox — Add/Edit above (`onSubmit`) already call
  // Supabase directly too, and there's no client_uuid column on this table
  // for the outbox's upsert-on-conflict replay to key off. So rather than
  // make Delete offline-capable while Add/Edit still aren't (a new, worse
  // inconsistency), this just fails clearly instead of with a generic
  // network-error toast — matching how the rest of Inventory already works.
  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;

    if (!navigator.onLine) {
      toast.error(`Can't delete "${target.name}" — Inventory needs an internet connection (it isn't queued for offline sync like Sales/Expenses are).`);
      setDeleteTarget(null);
      return;
    }

    setDeletingId(target.product_id);

    const { error } = await (supabase.from("products") as any)
      .delete()
      .eq("product_id", target.product_id);

    setDeletingId(null);
    setDeleteTarget(null);

    if (error) {
      // Foreign key constraints (sale_items / purchases referencing this
      // product) are the most likely failure — surface that plainly rather
      // than a raw Postgres error string.
      if (error.code === "23503") {
        toast.error(`Can't delete "${target.name}" — it has sales or purchase history. Deactivate it instead.`);
      } else {
        toast.error(error.message);
      }
      return;
    }

    setProducts((prev) => prev.filter((p) => p.product_id !== target.product_id));
    toast.success(`"${target.name}" deleted`);
  }

  const filtered = products.filter((p) => {
    const matchQ =
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.upc_barcode ?? "").toLowerCase().includes(query.toLowerCase()) ||
      p.product_id.toLowerCase().includes(query.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    return matchQ && matchCat;
  });

  const lowStockCount = products.filter((p) => p.is_active && p.current_stock <= p.reorder_level).length;

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {products.filter((p) => p.is_active).length} active SKUs
            {lowStockCount > 0 && (
              <span className="ml-2 text-destructive">· {lowStockCount} need restocking</span>
            )}
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, barcode, or ID…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Margin</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <PackageSearch className="h-8 w-8" />
                        <p className="text-sm">
                          {query || categoryFilter !== "all"
                            ? "No products match your filters"
                            : "No products yet — add one above"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr
                      key={p.product_id}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/40",
                        !p.is_active && "opacity-50",
                        deletingId === p.product_id && "opacity-40"
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.product_id}{p.upc_barcode ? ` · ${p.upc_barcode}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatINR(p.cost_price)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatINR(p.selling_price)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-primary">
                        {(p.margin_percentage ?? 0).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="tabular-nums font-medium">{p.current_stock} {p.unit}</span>
                          <StockBadge current={p.current_stock} reorder={p.reorder_level} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => void toggleActive(p)}
                          title={p.is_active ? "Deactivate" : "Reactivate"}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {p.is_active
                            ? <ToggleRight className="h-5 w-5 text-primary" />
                            : <ToggleLeft className="h-5 w-5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {/* Standardized action button group — same size, gap,
                            and hover treatment used in Expenses/Purchases rows */}
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => requestDelete(p)}
                            disabled={deletingId === p.product_id}
                            title="Delete"
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            {deletingId === p.product_id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Product ID *</Label>
                <Input placeholder="e.g. P017" {...register("product_id")} disabled={!!editing} />
                {errors.product_id && <p className="text-xs text-destructive">{errors.product_id.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>UPC / Barcode</Label>
                <Input placeholder="(optional)" {...register("upc_barcode")} />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Product Name *</Label>
                <Input placeholder="e.g. Basmati Rice Premium 1Kg" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={watch("category")} onValueChange={(v) => setValue("category", v, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Unit *</Label>
                <Select value={watch("unit")} onValueChange={(v) => setValue("unit", v, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Cost Price (₹) *</Label>
                <Input type="number" step="0.01" min="0" {...register("cost_price")} />
                {errors.cost_price && <p className="text-xs text-destructive">{errors.cost_price.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Selling Price (₹) *</Label>
                <Input type="number" step="0.01" min="0" {...register("selling_price")} />
                {errors.selling_price && <p className="text-xs text-destructive">{errors.selling_price.message}</p>}
              </div>

              {(() => {
                const cost = Number(watch("cost_price")) || 0;
                const sell = Number(watch("selling_price")) || 0;
                const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
                const profit = sell - cost;
                return (
                  <div className="col-span-2 flex justify-between rounded-md bg-muted px-4 py-2 text-xs">
                    <span className="text-muted-foreground">Profit / unit</span>
                    <span className={profit >= 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
                      {formatINR(profit)} ({margin.toFixed(1)}% margin)
                    </span>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <Label>Reorder Level</Label>
                <Input type="number" min="0" {...register("reorder_level")} />
              </div>
              <div className="space-y-1.5">
                <Label>Current Stock</Label>
                <Input type="number" min="0" {...register("current_stock")} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save Changes" : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shared delete confirmation modal */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={deleteTarget?.name ?? ""}
        itemLabel="product"
        isDeleting={!!deletingId}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
