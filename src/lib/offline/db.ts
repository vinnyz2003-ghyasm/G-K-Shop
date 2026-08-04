import Dexie, { type Table } from "dexie";

export type OutboxTableName = "sales" | "purchases" | "expenses" | "customers" | "sale_items";

export interface OutboxItem {
  id?: number;
  table: OutboxTableName;
  client_uuid: string;
  conflictColumn: string;
  payload: Record<string, unknown>;
  // ─── FIX ─────────────────────────────────────────────────────────────────
  // "abandoned" was missing from this union — sync-engine.ts sets this status
  // when an item exceeds MAX_RETRY_ATTEMPTS. TypeScript rejected the build
  // because the type here only had "pending" | "syncing" | "failed" | "synced".
  // ─────────────────────────────────────────────────────────────────────────
  status: "pending" | "syncing" | "failed" | "synced" | "abandoned";
  attempts: number;
  last_error?: string;
  created_at: string;
  // ─── NEW ─────────────────────────────────────────────────────────────────
  // Defaults to "upsert" when absent (via `item.operation ?? "upsert"` in
  // sync-engine.ts), so this stays backward-compatible with anything already
  // queued in a real user's browser before this field existed. For a
  // "delete" item, `client_uuid` holds the id VALUE and `conflictColumn`
  // holds the id COLUMN to match on — same two fields upsert already uses,
  // just reused for .eq() instead of onConflict; `payload` is unused ({}).
  // ─────────────────────────────────────────────────────────────────────────
  operation?: "upsert" | "delete";
}

export interface CachedProduct {
  product_id: string;
  name: string;
  upc_barcode: string | null;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  current_stock: number;
}

export interface CachedCustomer {
  customer_id: string;
  name: string;
  phone: string | null;
  is_unspecified: boolean;
}

class GnKOfflineDB extends Dexie {
  outbox!: Table<OutboxItem, number>;
  cachedProducts!: Table<CachedProduct, string>;
  cachedCustomers!: Table<CachedCustomer, string>;

  constructor() {
    super("GnKShopTrackerDB");
    this.version(2).stores({
      outbox: "++id, table, client_uuid, status, created_at",
      cachedProducts: "product_id, upc_barcode, name",
      cachedCustomers: "customer_id, name",
    });
  }
}

export const offlineDB = typeof window !== "undefined"
  ? new GnKOfflineDB()
  : (null as unknown as GnKOfflineDB);
