"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Search, Loader2, Receipt, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";

import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/utils/currency";
import { formatDateDisplay, todayIST } from "@/lib/utils/date";
import { submitOrQueue, queueDelete } from "@/lib/offline/sync-engine";
import { expenseSchema, type ExpenseInput } from "@/lib/validations/purchase-expense.schema";
import type { Database, ExpenseCategory, PaymentMode } from "@/lib/supabase/database.types";

type Expense = Database["public"]["Tables"]["expenses"]["Row"];

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Rent", "Electricity", "Staff Salary", "Wastage / Expiry",
  "Packaging", "Miscellaneous", "Transport", "Maintenance",
];
const PAYMENT_MODES: PaymentMode[] = ["Cash", "UPI", "Bank Transfer", "Card", "N/A"];

const CATEGORY_COLORS: Record<string, string> = {
  "Rent": "bg-indigo-500/20 text-indigo-400",
  "Electricity": "bg-yellow-500/20 text-yellow-400",
  "Staff Salary": "bg-blue-500/20 text-blue-400",
  "Wastage / Expiry": "bg-red-500/20 text-red-400",
  "Packaging": "bg-green-500/20 text-green-400",
  "Miscellaneous": "bg-slate-500/20 text-slate-400",
  "Transport": "bg-orange-500/20 text-orange-400",
  "Maintenance": "bg-purple-500/20 text-purple-400",
};

const EMPTY: ExpenseInput = {
  expense_date: todayIST(),
  category: "Miscellaneous",
  description: "",
  amount: 0,
  payment_mode: "Cash",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Delete flow state ──────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("expenses") as any)
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });
    setExpenses(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } =
    useForm<ExpenseInput>({ resolver: zodResolver(expenseSchema), defaultValues: EMPTY });

  async function onSubmit(values: ExpenseInput) {
    setSaving(true);
    const clientUuid = crypto.randomUUID();
    const result = await submitOrQueue(
      "expenses",
      { ...values, client_uuid: clientUuid, description: values.description || null },
      "client_uuid",
      clientUuid
    );
    setSaving(false);
    if (result.status === "synced") toast.success("Expense logged");
    else toast.warning("Saved offline — will sync when back online");
    setModalOpen(false);
    reset(EMPTY);
    void load(); // full reload here is fine — this is a create, not the hot delete path
  }

  // ── Optimistic delete ────────────────────────────────────────────────────────
  // Step 1: trash icon on a row → stage it, open the shared confirm modal.
  function requestDelete(e: Expense) {
    setDeleteTarget(e);
  }

  // Step 2: user confirms → THIS is the optimistic update.
  //   a) Remove the row from local state immediately — the UI (including the
  //      "Total shown" footer, which derives from `expenses` via .reduce) updates
  //      in the same render, with no spinner and no wait on the network.
  //   b) Close the modal immediately — no lag between "Delete" click and the
  //      row disappearing, which is the actual bug being fixed here.
  //   c) Fire the delete through the SAME offline outbox creates already use
  //      (queueDelete mirrors submitOrQueue) — so deleting while offline
  //      queues and syncs later instead of hard-failing. Previously this
  //      called supabase.delete() directly, which meant deleting was the one
  //      write on this page that DIDN'T work offline even though creating an
  //      expense already did.
  //   d) If it comes back as an outright error (not just "queued"), put the
  //      row back exactly where it was (by re-inserting and re-sorting) and
  //      show a toast explaining the rollback — the user's list ends up
  //      consistent with the database either way, they're just not blocked
  //      waiting to find out.
  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;

    // (a) + (b) — instant local removal, instant modal close
    setExpenses((prev) => prev.filter((e) => e.expense_id !== target.expense_id));
    setDeleteTarget(null);

    // (c) — background request, not awaited by the UI before removing the row
    const result = await queueDelete("expenses", "expense_id", target.expense_id);

    if (result.status === "error") {
      // (d) — rollback: put it back in date-order, then newest-first within
      // the same date, matching the original query's .order() clauses.
      setExpenses((prev) => {
        const restored = [...prev, target];
        return restored.sort((a, b) => {
          if (a.expense_date !== b.expense_date) return b.expense_date.localeCompare(a.expense_date);
          return b.created_at.localeCompare(a.created_at);
        });
      });
      toast.error(`Couldn't delete "${target.category}" expense — restored. ${result.message}`);
      return;
    }

    // Success toast is deliberately quiet/short since the row already
    // vanished a moment ago — this just confirms it's permanent. "queued"
    // gets the same warning phrasing the create flow already uses above,
    // so offline behavior reads consistently across both actions.
    if (result.status === "queued") {
      toast.warning("Deleted — will sync when back online");
    } else {
      toast.success("Expense deleted");
    }
  }

  const filtered = expenses.filter((e) => {
    const matchQ = !query || (e.description ?? "").toLowerCase().includes(query.toLowerCase()) || e.category.toLowerCase().includes(query.toLowerCase());
    const matchCat = categoryFilter === "all" || e.category === categoryFilter;
    return matchQ && matchCat;
  });

  const totalByCategory = EXPENSE_CATEGORIES.map((cat) => ({
    category: cat,
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  // Both of these derive directly from `expenses` state, so the optimistic
  // removal above updates them in the exact same render — no separate
  // "recalculate totals" step, no flash of the stale total before it corrects.
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-medium text-destructive">{formatINR(grandTotal)}</span>
          </p>
        </div>
        <Button onClick={() => { reset(EMPTY); setModalOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
      </div>

      {totalByCategory.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {totalByCategory.map((c) => (
            <Card
              key={c.category}
              className="cursor-pointer transition-opacity"
              onClick={() => setCategoryFilter(categoryFilter === c.category ? "all" : c.category)}
            >
              <CardContent className="p-3">
                <p className="truncate text-xs text-muted-foreground">{c.category}</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-destructive">{formatINR(c.total)}</p>
                {categoryFilter === c.category && <p className="mt-0.5 text-xs text-primary">Filtered ↑</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search description or category…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Receipt className="h-8 w-8" />
                        <p className="text-sm">No expenses found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => (
                    <tr key={e.expense_id} className="border-b border-border/50 transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateDisplay(e.expense_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[e.category] ?? "bg-muted text-muted-foreground"}`}>
                          {e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.description || "—"}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{e.payment_mode}</Badge></td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-destructive">{formatINR(e.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        {/* Same button size/variant/hover treatment as Inventory's delete action */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => requestDelete(e)}
                          title="Delete"
                          className="hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border bg-muted/30">
                    <td colSpan={4} className="px-4 py-2 text-xs font-medium text-muted-foreground">Total shown</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-destructive">
                      {formatINR(filteredTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" max={todayIST()} {...register("expense_date")} />
                {errors.expense_date && <p className="text-xs text-destructive">{errors.expense_date.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Category *</Label>
                <Select value={watch("category")} onValueChange={(v) => setValue("category", v as any, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={2} placeholder="e.g. Monthly shop floor lease payment" {...register("description")} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input type="number" step="0.01" min="0.01" {...register("amount")} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select value={watch("payment_mode")} onValueChange={(v) => setValue("payment_mode", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shared delete confirmation modal — identical component/copy/layout as Inventory */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={deleteTarget ? `${deleteTarget.category} — ${formatINR(deleteTarget.amount)}` : ""}
        itemLabel="expense"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
