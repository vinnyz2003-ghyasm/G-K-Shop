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
import { cn } from "@/lib/utils/cn";
import { submitOrQueue, queueDelete } from "@/lib/offline/sync-engine";
import { expenseSchema, type ExpenseInput } from "@/lib/validations/purchase-expense.schema";
import type { Database } from "@/lib/supabase/database.types";

type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
type PaymentMode = Database["public"]["Enums"]["payment_mode"];

type Expense = Database["public"]["Tables"]["expenses"]["Row"];

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Rent", "Electricity", "Staff Salary", "Wastage / Expiry",
  "Packaging", "Miscellaneous", "Transport", "Maintenance",
];
const PAYMENT_MODES: PaymentMode[] = ["Cash", "UPI", "Bank Transfer", "Card", "N/A"];

const CATEGORY_COLORS: Record<string, string> = {
  "Rent": "bg-indigo-500/20 text-indigo-400 border-indigo-500/20",
  "Electricity": "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  "Staff Salary": "bg-blue-500/20 text-blue-400 border-blue-500/20",
  "Wastage / Expiry": "bg-red-500/20 text-red-400 border-red-500/20",
  "Packaging": "bg-green-500/20 text-green-400 border-green-500/20",
  "Miscellaneous": "bg-slate-500/20 text-slate-500 dark:text-slate-400 border-slate-500/20",
  "Transport": "bg-orange-500/20 text-orange-400 border-orange-500/20",
  "Maintenance": "bg-purple-500/20 text-purple-400 border-purple-500/20",
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
    void load();
  }

  // FIX: Added the missing function back in!
  function requestDelete(e: Expense) {
    setDeleteTarget(e);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;

    setExpenses((prev) => prev.filter((e) => e.expense_id !== target.expense_id));
    setDeleteTarget(null);

    const result = await queueDelete("expenses", "expense_id", target.expense_id);

    if (result.status === "error") {
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

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-medium text-destructive">{formatINR(grandTotal)}</span>
          </p>
        </div>
        <Button onClick={() => { reset(EMPTY); setModalOpen(true); }} className="gap-2 min-h-[44px]">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Expense</span>
        </Button>
      </div>

      {/* Category Totals Grid */}
      {totalByCategory.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {totalByCategory.map((c) => (
            <Card
              key={c.category}
              className="cursor-pointer transition-opacity active:scale-95 sm:active:scale-100"
              onClick={() => setCategoryFilter(categoryFilter === c.category ? "all" : c.category)}
            >
              <CardContent className="p-3">
                <p className="truncate text-xs text-muted-foreground">{c.category}</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-destructive">{formatINR(c.total)}</p>
                {categoryFilter === c.category && <p className="mt-0.5 text-xs font-medium text-primary">Filtered ↑</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search description or category…" className="pl-9 min-h-[44px] text-base" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-52 min-h-[44px] text-base"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Main Data Container */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Receipt className="h-8 w-8 opacity-40" />
              <p className="text-sm">No expenses found</p>
            </div>
          ) : (
            <div className="w-full">
              {/* MOBILE VIEW: Stacked Touch Cards */}
              <div className="grid grid-cols-1 gap-3 p-3 md:hidden">
                {filtered.map((e) => (
                  <div key={e.expense_id} className="flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", CATEGORY_COLORS[e.category] ?? "bg-muted text-muted-foreground")}>
                          {e.category}
                        </span>
                        <span className="text-sm font-medium text-foreground leading-snug">
                          {e.description || "No description"}
                        </span>
                      </div>
                      <div className="flex flex-col items-end text-right shrink-0">
                        <span className="font-bold text-base text-destructive tabular-nums">{formatINR(e.amount)}</span>
                        <span className="text-xs text-muted-foreground mt-1">{formatDateDisplay(e.expense_date)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                      <Badge variant="outline" className="text-xs bg-muted/30 font-medium px-2 py-0.5">
                        {e.payment_mode}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => requestDelete(e)}
                        aria-label={`Delete ${e.category} expense`}
                        className="min-h-[44px] min-w-[44px] p-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Mobile Filtered Total Footer */}
                <div className="mt-2 flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                  <span className="text-sm font-medium text-muted-foreground">Total shown</span>
                  <span className="font-bold tabular-nums text-destructive text-lg">{formatINR(filteredTotal)}</span>
                </div>
              </div>

              {/* DESKTOP VIEW: Standard Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr key={e.expense_id} className="border-b border-border/50 transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateDisplay(e.expense_date)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", CATEGORY_COLORS[e.category] ?? "bg-muted text-muted-foreground")}>
                            {e.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">{e.description || "—"}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs bg-muted/30">{e.payment_mode}</Badge></td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-destructive">{formatINR(e.amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => requestDelete(e)}
                            title="Delete"
                            aria-label={`Delete ${e.category} expense`}
                            className="min-h-[36px] min-w-[36px] p-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/30">
                      <td colSpan={4} className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Total shown</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-destructive text-base">
                        {formatINR(filteredTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" max={todayIST()} className="min-h-[44px] text-base" {...register("expense_date")} />
                {errors.expense_date && <p className="text-xs text-destructive">{errors.expense_date.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Category *</Label>
                <Select value={watch("category")} onValueChange={(v) => setValue("category", v as any, { shouldValidate: true })}>
                  <SelectTrigger className="min-h-[44px] text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={2} className="text-base min-h-[44px]" placeholder="e.g. Monthly shop floor lease payment" {...register("description")} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input type="text" inputMode="decimal" pattern="[0-9]*" className="min-h-[44px] text-base" {...register("amount")} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select value={watch("payment_mode")} onValueChange={(v) => setValue("payment_mode", v as any)}>
                  <SelectTrigger className="min-h-[44px] text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2 min-h-[44px]">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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