"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { offlineDB, type CachedCustomer } from "@/lib/offline/db";
import { submitOrQueue } from "@/lib/offline/sync-engine";

const NEW_CUSTOMER_VALUE = "__new__";

export function CustomerPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (customerId: string | null) => void;
}) {
  const [customers, setCustomers] = useState<CachedCustomer[]>([]);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // ─── BUG FIX #9 ────────────────────────────────────────────────────────────
  // Same unmounted-setState memory leak as ItemizedSaleForm: if the CustomerPicker
  // unmounts (e.g. user clears the credit field and the picker is removed) while
  // the fetch is still running, setCustomers fires on an unmounted component.
  // The mountedRef guard makes this safe.
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
            .from("customers")
            .select("customer_id, name, phone, is_unspecified")
            .eq("is_unspecified", false)
            .order("name");
          if (data && mountedRef.current) {
            setCustomers(data);
            await offlineDB?.cachedCustomers.bulkPut(data);
            return;
          }
        }
        const cached = (await offlineDB?.cachedCustomers.toArray()) ?? [];
        if (mountedRef.current) setCustomers(cached.filter((c) => !c.is_unspecified));
      } catch (err) {
        console.error("[CustomerPicker] fetch error:", err);
      }
    })();
  }, []);

  async function handleAddCustomer() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const customerId = crypto.randomUUID();
      await submitOrQueue("customers", { customer_id: customerId, name: newName.trim() }, "customer_id", customerId);

      const newCustomer: CachedCustomer = {
        customer_id: customerId,
        name: newName.trim(),
        phone: null,
        is_unspecified: false,
      };
      if (mountedRef.current) {
        setCustomers((prev) => [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name)));
      }
      await offlineDB?.cachedCustomers.put(newCustomer);

      onChange(customerId);
      setNewName("");
      setShowNewInput(false);
    } catch (err) {
      console.error("[CustomerPicker] add customer error:", err);
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  if (showNewInput) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          placeholder="Customer name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleAddCustomer(); }}
        />
        <Button type="button" size="sm" onClick={() => void handleAddCustomer()} disabled={saving}>
          Add
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewInput(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value ?? undefined}
      onValueChange={(v) => (v === NEW_CUSTOMER_VALUE ? setShowNewInput(true) : onChange(v))}
    >
      <SelectTrigger>
        <SelectValue placeholder="Who owes this? (Udhaar)" />
      </SelectTrigger>
      <SelectContent>
        {customers.map((c) => (
          <SelectItem key={c.customer_id} value={c.customer_id}>{c.name}</SelectItem>
        ))}
        <SelectItem value={NEW_CUSTOMER_VALUE} className="text-primary">
          <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add new customer</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
