"use client";

// Minimal product-creation form, opened when BarcodeScannerDialog scans a
// code that doesn't match anything in `products`. Deliberately shows only
// the fields required to get a usable product on record fast while standing
// at a delivery — reorder_level and current_stock are set to sensible
// defaults (10 and 0) rather than shown here; current_stock in particular
// starts at 0 on purpose, since the purchase you're about to log is what
// actually brings stock in. Full editing (margins, exact reorder point,
// deactivating, etc.) still happens on the Inventory page as normal.
//
// Reuses productSchema from validations/product.schema.ts directly, so this
// can never drift from what Inventory's own Add/Edit form considers valid.
//
// DESIGN DECISION on product_id vs upc_barcode (resolved, not left open):
// product_id stays the real required primary key underneath — making
// upc_barcode required instead would break for any product that doesn't
// have a manufacturer barcode at all (loose grains, spices, produce,
// homemade items — a lot of a kirana shop's actual inventory), and a
// nullable primary key isn't really valid relational design either way.
// What changes instead is the FORM: the barcode is shown prominently at the
// top since this flow only ever runs after a successful scan, and
// product_id is auto-generated from that scan and tucked behind a
// "Customize ID" toggle, closed by default. The database still requires a
// real product_id; the person scanning never has to think about it unless
// they choose to. Non-barcoded products are added the normal way through
// Inventory's own Add Product form, untouched by any of this.

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PackagePlus, ScanLine, ChevronRight, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { createClient } from "@/lib/supabase/client";
import { offlineDB } from "@/lib/offline/db";
import { productSchema, CATEGORIES, UNITS, type ProductInput } from "@/lib/validations/product.schema";

interface QuickAddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scannedBarcode: string;
  onCreated: (product: { product_id: string; name: string; unit: string }) => void;
}

// Turns a scanned barcode into a usable starting product_id — strips
// anything outside [A-Za-z0-9_-] so it always satisfies productSchema's
// regex without the user needing to type one from scratch.
function suggestProductId(barcode: string): string {
  const cleaned = barcode.replace(/[^A-Za-z0-9_-]/g, "");
  return cleaned || `SKU-${Date.now()}`;
}

export function QuickAddProductDialog({ open, onOpenChange, scannedBarcode, onCreated }: QuickAddProductDialogProps) {
  const supabase = createClient();
  const [customizingId, setCustomizingId] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } =
    useForm<ProductInput>({
      resolver: zodResolver(productSchema),
      defaultValues: {
        product_id: "", name: "", upc_barcode: "", category: "", unit: "Pc",
        cost_price: 0, selling_price: 0, reorder_level: 10, current_stock: 0, is_active: true,
      },
    });

  // Re-seed the form every time a *new* scan opens this dialog, so leftover
  // values from a previous quick-add don't carry over.
  useEffect(() => {
    if (open) {
      setCustomizingId(false);
      reset({
        product_id: suggestProductId(scannedBarcode), name: "", upc_barcode: scannedBarcode,
        category: "", unit: "Pc", cost_price: 0, selling_price: 0, reorder_level: 10,
        current_stock: 0, is_active: true,
      });
    }
  }, [open, scannedBarcode, reset]);

  // The ID panel is collapsed by default, but if an invalid/duplicate ID is
  // ever the reason submission is blocked, force it open — an error hidden
  // behind a closed toggle is worse than no validation at all.
  const idPanelOpen = customizingId || !!errors.product_id;

  async function onSubmit(values: ProductInput) {
    // Products aren't part of the offline outbox anywhere in this app — no
    // client_uuid column on the table, and Inventory's own Add/Edit call
    // Supabase directly too (confirmed intentional existing scope). The
    // first draft had no offline guard at all, though: attempting this while
    // offline would just throw inside the insert call below with nothing
    // shown to the person. Matching how Inventory's own delete flow handles
    // the identical situation, check first and say so plainly instead of
    // letting it fail silently.
    if (!navigator.onLine) {
      toast.error("Can't add a new product while offline — Products aren't queued for offline sync like Sales/Purchases are. Reconnect and try again.");
      return;
    }

    try {
      const { error } = await (supabase.from("products") as any).insert(values);

      if (error) {
        if (error.code === "23505") {
          // Only realistically reachable if two people quick-add the same new
          // barcode within moments of each other, or someone customizes the ID
          // into one that collides with an existing product.
          toast.error(`That Product ID is already in use — open "Customize ID" and try a different one.`);
          setCustomizingId(true);
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Write-through to the offline product cache — same pattern
      // CustomerPicker already uses right after creating a new customer —
      // so this product is usable immediately (another scan, or
      // ItemizedSaleForm) even if connectivity drops before the next full
      // refreshOfflineCache() run.
      await offlineDB?.cachedProducts.put({
        product_id: values.product_id,
        name: values.name,
        upc_barcode: values.upc_barcode ?? null,
        category: values.category,
        unit: values.unit,
        cost_price: values.cost_price,
        selling_price: values.selling_price,
        reorder_level: values.reorder_level,
        current_stock: values.current_stock,
      });

      toast.success(`"${values.name}" added to Inventory`);
      onCreated({ product_id: values.product_id, name: values.name, unit: values.unit });
    } catch (err) {
      // Guards against a thrown network exception slipping past react-hook-
      // form's own isSubmitting reset with no user-facing feedback at all —
      // the same failure mode EODQuickEntryForm already guards against.
      toast.error("Unexpected error adding product — please try again");
      console.error("[QuickAddProduct] submit error:", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-4 w-4" /> New Product
          </DialogTitle>
        </DialogHeader>

        {/* Barcode is the headline here on purpose — this dialog only ever
            opens after a successful scan, so it's the one piece of
            information the person already knows is correct. */}
        <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
          <ScanLine className="h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Scanned Barcode</p>
            <p className="font-mono text-sm font-medium">{scannedBarcode}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Product Name *</Label>
              <Input placeholder="e.g. Tata Salt 1kg" autoFocus {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Category *</Label>
              <Select value={watch("category")} onValueChange={(v) => setValue("category", v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
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

            <div className="col-span-2 space-y-1.5">
              <Label>Selling Price (₹) *</Label>
              <Input type="number" step="0.01" min="0" {...register("selling_price")} />
              {errors.selling_price && <p className="text-xs text-destructive">{errors.selling_price.message}</p>}
            </div>
          </div>

          {/* Product ID: real required primary key underneath, but collapsed
              by default — auto-generated from the barcode above, so nobody
              has to think about it unless they specifically want to. */}
          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setCustomizingId((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Product ID: <span className="font-mono text-foreground">{watch("product_id")}</span></span>
              {idPanelOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {idPanelOpen && (
              <div className="space-y-1.5 border-t border-border px-3 py-2.5">
                <Label className="text-xs">Customize Product ID</Label>
                <Input className="font-mono" {...register("product_id")} />
                <p className="text-xs text-muted-foreground">Letters, numbers, hyphens, underscores only. Auto-filled from the barcode above by default.</p>
                {errors.product_id && <p className="text-xs text-destructive">{errors.product_id.message}</p>}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Product &amp; Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
