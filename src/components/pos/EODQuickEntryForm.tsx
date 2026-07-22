"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import { CustomerPicker } from "./CustomerPicker";
import { eodSaleSchema, type EodSaleInput } from "@/lib/validations/sale.schema";
import { todayIST } from "@/lib/utils/date";
import { formatINR } from "@/lib/utils/currency";
import { submitOrQueue } from "@/lib/offline/sync-engine";

// ─── BUG FIX #1 ──────────────────────────────────────────────────────────────
// DEFAULTS was previously a module-level constant, so todayIST() was called
// exactly once at import time. In a PWA that stays open overnight (common on a
// shop counter that is never closed), the "today" date would be yesterday's
// date for any sale entered after midnight. Moving this to a factory function
// ensures the date is freshly computed every time the form is reset.
// ─────────────────────────────────────────────────────────────────────────────
function makeDefaults(): EodSaleInput {
  return {
    sale_date: todayIST(),   // always the real IST "today" at the moment of reset
    cash_amount: 0,
    upi_amount: 0,
    credit_amount: 0,
    customer_id: null,
    remarks: "",
  };
}

export function EODQuickEntryForm({ onSaved }: { onSaved?: () => void }) {
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<EodSaleInput>({
    resolver: zodResolver(eodSaleSchema),
    defaultValues: makeDefaults(),   // fresh date on every form mount
  });

  const [cash, upi, credit] = watch(["cash_amount", "upi_amount", "credit_amount"]);
  const total = (Number(cash) || 0) + (Number(upi) || 0) + (Number(credit) || 0);
  const showCustomerPicker = (Number(credit) || 0) > 0;

  async function onSubmit(values: EodSaleInput) {
    setIsSaving(true);
    // ─── BUG FIX #2 (partial) ──────────────────────────────────────────────
    // try/finally guarantees setIsSaving(false) even if submitOrQueue throws
    // an unexpected exception — previously an uncaught throw here left the
    // Save button disabled for the rest of the session.
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const clientUuid = crypto.randomUUID();
      const result = await submitOrQueue(
        "sales",
        {
          client_uuid: clientUuid,
          sale_date: values.sale_date,
          entry_mode: "eod_summary",
          cash_amount: values.cash_amount,
          upi_amount: values.upi_amount,
          credit_amount: values.credit_amount,
          customer_id: values.credit_amount > 0 ? values.customer_id ?? null : null,
          remarks: values.remarks || null,
        },
        "client_uuid",
        clientUuid
      );

      if (result.status === "synced") {
        toast.success(`Sale logged — ${formatINR(total)} total`);
      } else {
        toast.warning("Saved offline — will sync automatically once you're back online", {
          description: `${formatINR(total)} queued for ${values.sale_date}`,
        });
      }

      // Re-generate defaults so the date is "today" even if we crossed midnight
      // during a long session. We deliberately keep the user's chosen date so
      // rapid back-to-back EOD entries for the same date stay efficient.
      reset({ ...makeDefaults(), sale_date: values.sale_date });
      onSaved?.();
    } catch (err) {
      toast.error("Unexpected error — please try again");
      console.error("[EOD] submit error:", err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="sale_date">Date</Label>
              <Input
                id="sale_date"
                type="date"
                max={todayIST()}
                {...register("sale_date")}
              />
              {errors.sale_date && <p className="text-xs text-destructive">{errors.sale_date.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cash_amount">Cash (₹)</Label>
              <Input id="cash_amount" type="number" inputMode="decimal" step="1" min="0" {...register("cash_amount")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upi_amount">UPI / Online (₹)</Label>
              <Input id="upi_amount" type="number" inputMode="decimal" step="1" min="0" {...register("upi_amount")} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="credit_amount">Credit / Udhaar (₹)</Label>
              <Input id="credit_amount" type="number" inputMode="decimal" step="1" min="0" {...register("credit_amount")} />
            </div>
            {errors.cash_amount && <p className="col-span-2 text-xs text-destructive">{errors.cash_amount.message}</p>}

            {showCustomerPicker && (
              <div className="col-span-2 space-y-1.5">
                <Label>Udhaar customer</Label>
                <Controller
                  control={control}
                  name="customer_id"
                  render={({ field }) => <CustomerPicker value={field.value ?? null} onChange={field.onChange} />}
                />
                <p className="text-xs text-muted-foreground">
                  Skip this and it lands in the &ldquo;Unspecified&rdquo; bucket — harder to collect later.
                </p>
              </div>
            )}

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea id="remarks" rows={2} placeholder="e.g. Weekend spike in snacks & beverages" {...register("remarks")} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground">Total EOD Revenue</span>
            <span className="text-lg font-semibold tabular-nums text-primary">{formatINR(total)}</span>
          </div>

          <Button type="submit" disabled={isSaving} className="w-full gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Saving…" : "Save Sale"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
