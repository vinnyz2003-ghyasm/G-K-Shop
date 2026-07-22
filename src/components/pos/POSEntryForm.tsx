"use client";

import { ListChecks, ScanBarcode } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OfflineSyncBadge } from "./OfflineSyncBadge";
import { EODQuickEntryForm } from "./EODQuickEntryForm";
import { ItemizedSaleForm } from "./ItemizedSaleForm";

export function POSEntryForm({ onSaved }: { onSaved?: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">New Sale</h1>
        <OfflineSyncBadge />
      </div>

      <Tabs defaultValue="eod">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="eod" className="gap-1.5">
            <ListChecks className="h-4 w-4" /> EOD Quick Entry
          </TabsTrigger>
          <TabsTrigger value="itemized" className="gap-1.5">
            <ScanBarcode className="h-4 w-4" /> Itemized Sale
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eod" className="mt-3">
          <p className="mb-3 text-xs text-muted-foreground">
            Fastest path — log today&rsquo;s cash/UPI/credit totals in one go, the way you did in the spreadsheet.
            Doesn&rsquo;t touch per-product stock.
          </p>
          <EODQuickEntryForm onSaved={onSaved} />
        </TabsContent>

        <TabsContent value="itemized" className="mt-3">
          <p className="mb-3 text-xs text-muted-foreground">
            Scan or search each item sold — stock decrements automatically and feeds true per-product profit.
          </p>
          <ItemizedSaleForm onSaved={onSaved} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
