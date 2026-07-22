import { createClient } from "@/lib/supabase/client";
import { offlineDB } from "./db";
import type { OutboxTableName } from "./db";

const MAX_RETRY_ATTEMPTS = 5;

// ─── BUG FIX ─────────────────────────────────────────────────────────────────
// Previously, items that exceeded MAX_RETRY_ATTEMPTS were kept as status="failed"
// but still counted in pendingOutboxCount(). This caused "Sync 7 pending" to
// never clear even when items were permanently abandoned. Now abandoned items
// get status="abandoned" so they are excluded from the pending count but still
// visible in the Settings diagnostic panel for inspection.
// ─────────────────────────────────────────────────────────────────────────────

function isTransientError(error: { message?: string; code?: string; status?: number } | null): boolean {
  if (!error) return false;
  const status = error.status ?? 0;
  const pgConstraintCodes = ["23505", "23503", "23514", "23502"];
  if (pgConstraintCodes.includes(error.code ?? "")) return false;
  if (status >= 400 && status < 500) return false;
  return true;
}

type SubmitResult =
  | { status: "synced"; data: unknown }
  | { status: "queued"; localKey: string }
  | { status: "error"; message: string };

export async function submitOrQueue(
  table: OutboxTableName,
  payload: Record<string, unknown>,
  idColumn: string,
  idValue: string
): Promise<SubmitResult> {
  const supabase = createClient();

  if (navigator.onLine) {
    try {
      const { data, error } = await (supabase.from(table) as any)
        .upsert(payload, { onConflict: idColumn })
        .select()
        .single();

      if (!error) return { status: "synced", data };

      if (!isTransientError(error)) {
        return { status: "error", message: error.message };
      }
    } catch {
      // Network error — fall through to queue
    }
  }

  await offlineDB.outbox.add({
    table,
    client_uuid: idValue,
    conflictColumn: idColumn,
    payload,
    status: "pending",
    attempts: 0,
    created_at: new Date().toISOString(),
  });

  return { status: "queued", localKey: idValue };
}

// ─── BUG FIX ─────────────────────────────────────────────────────────────────
// Only count "pending" and "failed" (retryable) items.
// "abandoned" items are excluded — they are shown in Settings diagnostics only.
// ─────────────────────────────────────────────────────────────────────────────
export async function pendingOutboxCount(): Promise<number> {
  if (!offlineDB) return 0;
  return offlineDB.outbox.where("status").anyOf(["pending", "failed"]).count();
}

export async function getFailedOutboxItems() {
  if (!offlineDB) return [];
  return offlineDB.outbox
    .where("status")
    .anyOf(["failed", "abandoned"])
    .toArray();
}

export async function clearAbandonedItems(): Promise<number> {
  if (!offlineDB) return 0;
  const abandoned = await offlineDB.outbox
    .where("status")
    .equals("abandoned")
    .toArray();
  for (const item of abandoned) {
    await offlineDB.outbox.delete(item.id!);
  }
  return abandoned.length;
}

export async function clearAllOutbox(): Promise<number> {
  if (!offlineDB) return 0;
  const all = await offlineDB.outbox.toArray();
  for (const item of all) {
    await offlineDB.outbox.delete(item.id!);
  }
  return all.length;
}

export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  tablesExist: boolean;
  authenticated: boolean;
  error?: string;
}> {
  try {
    const supabase = createClient();

    // Test 1: Can we reach Supabase at all?
    const { data: authData } = await supabase.auth.getSession();
    const authenticated = !!authData.session;

    // Test 2: Do the tables exist?
    const { error: tableError } = await supabase
      .from("products")
      .select("product_id")
      .limit(1);

    if (tableError) {
      return {
        connected: true,
        tablesExist: false,
        authenticated,
        error: tableError.message,
      };
    }

    return { connected: true, tablesExist: true, authenticated };
  } catch (err: any) {
    return {
      connected: false,
      tablesExist: false,
      authenticated: false,
      error: err?.message ?? "Cannot reach Supabase",
    };
  }
}

export async function flushOutbox(): Promise<{
  synced: number;
  failed: number;
  abandoned: number;
}> {
  if (!offlineDB || !navigator.onLine) return { synced: 0, failed: 0, abandoned: 0 };

  const supabase = createClient();

  // Only pick up pending and failed (retryable) items — not abandoned
  const queued = await offlineDB.outbox
    .where("status")
    .anyOf(["pending", "failed"])
    .sortBy("created_at");

  let synced = 0;
  let failed = 0;
  let abandoned = 0;

  for (const item of queued) {
    // ─── BUG FIX ───────────────────────────────────────────────────────────
    // Previously abandoned items stayed as "failed" and were counted in
    // pendingOutboxCount forever. Now they move to "abandoned" status
    // which excludes them from the count but keeps them visible for inspection.
    // ─────────────────────────────────────────────────────────────────────────
    if (item.attempts >= MAX_RETRY_ATTEMPTS) {
      await offlineDB.outbox.update(item.id!, {
        status: "abandoned",
        last_error: `Abandoned after ${MAX_RETRY_ATTEMPTS} attempts. Last: ${item.last_error ?? "unknown"}`,
      });
      abandoned += 1;
      continue;
    }

    await offlineDB.outbox.update(item.id!, { status: "syncing" });

    try {
      const { error } = await (supabase.from(item.table) as any)
        .upsert(item.payload, { onConflict: item.conflictColumn });

      if (error) {
        failed += 1;
        await offlineDB.outbox.update(item.id!, {
          status: "failed",
          attempts: item.attempts + 1,
          last_error: error.message,
        });
      } else {
        synced += 1;
        await offlineDB.outbox.delete(item.id!);
      }
    } catch (err: any) {
      failed += 1;
      await offlineDB.outbox.update(item.id!, {
        status: "failed",
        attempts: item.attempts + 1,
        last_error: err?.message ?? "Network error",
      });
    }
  }

  return { synced, failed, abandoned };
}

export function startAutoSync(intervalMs = 30_000): () => void {
  if (typeof window === "undefined") return () => {};

  const onOnline = () => void flushOutbox();
  window.addEventListener("online", onOnline);

  const interval = setInterval(() => {
    if (navigator.onLine) void flushOutbox();
  }, intervalMs);

  return () => {
    window.removeEventListener("online", onOnline);
    clearInterval(interval);
  };
}

export async function refreshOfflineCache() {
  if (!offlineDB || !navigator.onLine) return;
  const supabase = createClient();

  const { data: products } = await supabase
    .from("products")
    .select("product_id, name, upc_barcode, category, unit, cost_price, selling_price, reorder_level, current_stock")
    .eq("is_active", true);
  if (products) await offlineDB.cachedProducts.bulkPut(products);

  const { data: customers } = await supabase
    .from("customers")
    .select("customer_id, name, phone, is_unspecified");
  if (customers) await offlineDB.cachedCustomers.bulkPut(customers);
}
