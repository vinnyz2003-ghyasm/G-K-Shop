"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2, BookText, ChevronDown, ChevronRight, Phone, UserPlus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/utils/currency";
import { formatDateDisplay, todayIST } from "@/lib/utils/date";
import { udhaarPaymentSchema, type UdhaarPaymentInput } from "@/lib/validations/purchase-expense.schema";
import type { Database } from "@/lib/supabase/database.types";

type CustomerBalance = Database["public"]["Views"]["v_customer_balances"]["Row"];
type UdhaarTx = Database["public"]["Tables"]["udhaar_transactions"]["Row"];

export default function UdhaarPage() {
  const [balances, setBalances] = useState<CustomerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [txMap, setTxMap] = useState<Record<string, UdhaarTx[]>>({});
  const [loadingTx, setLoadingTx] = useState<string | null>(null);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerBalance | null>(null);
  const [saving, setSaving] = useState(false);

  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("v_customer_balances")
      .select("*")
      .eq("is_unspecified", false)
      .order("outstanding_balance", { ascending: false });
    setBalances(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggleExpand(customerId: string) {
    if (expanded === customerId) { setExpanded(null); return; }
    setExpanded(customerId);
    if (!txMap[customerId]) {
      setLoadingTx(customerId);
      const { data } = await supabase
        .from("udhaar_transactions")
        .select("*")
        .eq("customer_id", customerId)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      setTxMap((prev) => ({ ...prev, [customerId]: data ?? [] }));
      setLoadingTx(null);
    }
  }

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<UdhaarPaymentInput>({ resolver: zodResolver(udhaarPaymentSchema) });

  function openPayModal(customer: CustomerBalance) {
    setSelectedCustomer(customer);
    reset({ customer_id: customer.customer_id, amount: 0, entry_date: todayIST(), notes: "" });
    setPayModalOpen(true);
  }

  async function onPaySubmit(values: UdhaarPaymentInput) {
    setSaving(true);
    const { error } = await supabase.from("udhaar_transactions").insert({
      customer_id: values.customer_id,
      entry_type: "Payment Received",
      amount: values.amount,
      entry_date: values.entry_date,
      notes: values.notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Payment of ${formatINR(values.amount)} recorded for ${selectedCustomer?.name}`);
    setPayModalOpen(false);
    // refresh this customer's tx + balances
    setTxMap((prev) => { const n = { ...prev }; delete n[values.customer_id]; return n; });
    void load();
  }

  async function addCustomer() {
    if (!newName.trim()) return;
    setAddingCustomer(true);
    const { error } = await supabase.from("customers").insert({
      name: newName.trim(),
      phone: newPhone.trim() || null,
    });
    setAddingCustomer(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Customer added");
    setNewName(""); setNewPhone(""); setAddCustomerOpen(false);
    void load();
  }

  const totalOutstanding = balances.filter((b) => b.outstanding_balance > 0).reduce((s, b) => s + b.outstanding_balance, 0);
  const debtors = balances.filter((b) => b.outstanding_balance > 0).length;

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Udhaar (Credit Ledger)</h1>
          <p className="text-sm text-muted-foreground">
            {debtors} customer{debtors !== 1 ? "s" : ""} owe&nbsp;
            <span className="font-medium text-warning">{formatINR(totalOutstanding)}</span>
          </p>
        </div>
        <Button variant="outline" onClick={() => setAddCustomerOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Add Customer
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Total Outstanding", value: totalOutstanding, cls: "text-warning" },
          { label: "Customers with Debt", value: debtors, cls: "text-foreground", raw: true },
          { label: "Total Customers", value: balances.length, cls: "text-muted-foreground", raw: true },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${s.cls}`}>
                {s.raw ? String(s.value) : formatINR(s.value as number)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customer list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : balances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <BookText className="h-8 w-8" />
            <p className="text-sm">No credit customers yet. Add a customer above, or log a credit sale from New Sale.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {balances.map((b) => {
            const isExpanded = expanded === b.customer_id;
            const isLoading = loadingTx === b.customer_id;
            const txs = txMap[b.customer_id] ?? [];

            return (
              <Card key={b.customer_id} className={b.outstanding_balance > 0 ? "border-warning/30" : ""}>
                <CardContent className="p-0">
                  <div
                    className="flex cursor-pointer items-center justify-between gap-3 p-4"
                    onClick={() => void toggleExpand(b.customer_id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{b.name}</p>
                        {b.phone && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />{b.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-sm font-semibold tabular-nums ${b.outstanding_balance > 0 ? "text-warning" : "text-primary"}`}>
                          {formatINR(b.outstanding_balance)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.outstanding_balance > 0 ? "owes you" : b.outstanding_balance < 0 ? "overpaid" : "settled"}
                        </p>
                      </div>
                      {b.outstanding_balance > 0 && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openPayModal(b); }}
                          className="gap-1.5 text-xs"
                        >
                          <Plus className="h-3 w-3" /> Record Payment
                        </Button>
                      )}
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Transaction drill-down */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {isLoading ? (
                        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                      ) : txs.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-muted-foreground">No transactions yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground">
                              <th className="px-4 py-2 font-medium">Date</th>
                              <th className="px-4 py-2 font-medium">Type</th>
                              <th className="px-4 py-2 font-medium">Notes</th>
                              <th className="px-4 py-2 font-medium text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {txs.map((tx) => (
                              <tr key={tx.udhaar_id} className="border-t border-border/30">
                                <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDateDisplay(tx.entry_date)}</td>
                                <td className="px-4 py-2">
                                  <Badge
                                    variant={tx.entry_type === "Credit Given" ? "warning" : "default"}
                                    className={tx.entry_type === "Payment Received" ? "bg-primary/20 text-primary" : ""}
                                  >
                                    {tx.entry_type}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2 text-muted-foreground">{tx.notes || "—"}</td>
                                <td className={`px-4 py-2 text-right font-medium tabular-nums ${tx.entry_type === "Credit Given" ? "text-warning" : "text-primary"}`}>
                                  {tx.entry_type === "Credit Given" ? "+" : "-"}{formatINR(tx.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-border bg-muted/30">
                              <td colSpan={3} className="px-4 py-2 text-xs text-muted-foreground">Balance</td>
                              <td className={`px-4 py-2 text-right font-semibold tabular-nums ${b.outstanding_balance > 0 ? "text-warning" : "text-primary"}`}>
                                {formatINR(b.outstanding_balance)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Record Payment Modal */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment — {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onPaySubmit)} className="space-y-3">
            <input type="hidden" {...register("customer_id")} />
            <div className="rounded-md bg-muted px-4 py-3 text-sm">
              Outstanding: <span className="font-semibold text-warning">{formatINR(selectedCustomer?.outstanding_balance ?? 0)}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date *</Label>
              <Input type="date" max={todayIST()} {...register("entry_date")} />
              {errors.entry_date && <p className="text-xs text-destructive">{errors.entry_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Amount Received (₹) *</Label>
              <Input type="number" step="0.01" min="0.01" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="e.g. Cash collected at shop" {...register("notes")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Customer Modal */}
      <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Customer Name *</Label>
              <Input placeholder="e.g. Ravi Kumar" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input placeholder="e.g. 98765 43210" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCustomerOpen(false)}>Cancel</Button>
            <Button disabled={!newName.trim() || addingCustomer} onClick={() => void addCustomer()} className="gap-2">
              {addingCustomer && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
