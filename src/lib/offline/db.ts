import Dexie, { type Table } from "dexie";

/** Tables this app currently queues writes for. Add a new value here before wiring up a new module's offline support. */
export type OutboxTableName = "sales" | "purchases" | "expenses" | "customers" | "sale_items";

export interface OutboxItem {
  id?: number;                 // Dexie auto-increment local id
  table: OutboxTableName;
  client_uuid: string;         // local tracking key (shown in UI / used as the Dexie lookup, not necessarily a server column)
  conflictColumn: string;      // the column Supabase should upsert on — 'client_uuid' for sales/purchases/expenses,
                                // but 'customer_id' for customers and 'sale_item_id' for sale_items, since those
                                // tables don't have a separate client_uuid column — the client just supplies the PK itself.
  payload: Record<string, unknown>;
  status: "pending" | "syncing" | "failed" | "synced";
  attempts: number;
  last_error?: string;
  created_at: string;          // ISO timestamp, local device clock — also the sync replay order, so FK-dependent
                                // rows (e.g. a sale_items line needing its parent sales row to exist first) sync in order.
}

/** Read-only local mirrors, refreshed whenever the app is online, so POS/Udhaar screens still render with last-known data offline. */
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
    super("GnKShopTrackerDB"); // renamed from KiranaOfflineDB — version bump handles migration
    this.version(2).stores({
      outbox: "++id, table, client_uuid, status, created_at",
      cachedProducts: "product_id, upc_barcode, name",
      cachedCustomers: "customer_id, name",
    });
  }
}

// Dexie requires a browser (IndexedDB) context — guard for SSR.
export const offlineDB = typeof window !== "undefined" ? new GnKOfflineDB() : (null as unknown as GnKOfflineDB);
