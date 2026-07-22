# Kirana Shop Tracker

A PWA replacement for `Shop_Tracker_Ultimate_FIXED.xlsx` — POS logging, live inventory,
expense register, and a real-time P&L dashboard. Works at the counter even when the
connection drops.

## What's in this drop

This is the first installment: **schema + folder structure + the Dashboard and POS
modules**, fully wired end to end (DB → triggers → views → React → offline queue).
Inventory, Purchases, Expenses, and Udhaar have placeholder routes already in the nav —
they follow the exact same pattern (a migration table, a Dexie outbox entry, a form, a
view) and are the natural next request.

## 1. Set up Supabase

1. Create a project at supabase.com.
2. SQL Editor → run `supabase/migrations/0001_init.sql` (schema, triggers, views, RLS).
3. Run `supabase/seed.sql` to load your real product catalogue and recent transactions
   migrated from the Excel file — **read the comment block at the top of that file
   first**, it documents three data-quality issues found in your sheet (a product
   missing its reorder level, two purchase rows referencing a UPC that doesn't exist in
   Inventory, and two corrupted date cells) and exactly how each was handled.
4. Project Settings → API → copy the URL and anon key into `.env.local` (see
   `.env.local.example`).
5. Enable email or phone auth for at least one user (Authentication → Users) — every
   table's RLS policy currently requires `auth.role() = 'authenticated'`.

## 2. Run the app

```bash
npm install
npm run dev
```

Open `http://localhost:3000` → redirects to `/dashboard`.

To install it as an actual app on the phone you'll use at the counter: open the deployed
URL in Chrome/Safari on the phone → "Add to Home Screen". `next.config.mjs` builds the
service worker automatically on `npm run build` (it's disabled in dev mode).

## 3. Architecture decisions worth knowing about

- **Two sales entry modes share one `sales` table.** *EOD Quick Entry* is the fast path
  that mirrors your old spreadsheet habit (cash/UPI/credit totals, no per-item detail —
  doesn't touch stock). *Itemized Sale* scans/searches products line by line and
  decrements `current_stock` automatically via a trigger. Use EOD for speed, itemized
  when you want stock and true per-product profit to stay accurate.
- **COGS = Paid purchases for the period** (cash-basis), matching your original P&L
  Summary sheet's "Total Purchases → Gross Profit" logic. A `v_pnl_perpetual` view is
  included for when itemized entry is your norm and you want true matched-cost COGS
  instead (`qty × cost_price` per line sold).
- **"Active Credit (Udhaar)" on the dashboard ≠ today's credit sales.** It's the sum of
  every customer's *currently outstanding* balance (credit given minus payments
  received) — the number that actually answers "how much should I be collecting?"
- **Offline-first is a Dexie (IndexedDB) outbox, not just a service worker.** A write
  tries Supabase directly first; if that fails for any reason it's queued locally and
  replayed (oldest-first, idempotent via `client_uuid`/primary-key upserts) once you're
  back online. See `src/lib/offline/sync-engine.ts` — that file is the actual offline
  guarantee; the service worker in `next.config.mjs` only caches the app shell and GET
  responses so the dashboard still *renders* offline.
- **Known limitation:** an itemized sale logged offline that oversells a product (more
  units than the last-synced stock count) will fail to sync — the DB's
  `current_stock >= 0` check rejects it — and shows up as a "failed" item in the outbox
  rather than silently disappearing. You'd resolve it by correcting the line or
  restocking, then retrying. A future pass could surface that as an in-app prompt
  instead of a generic sync error.

## 4. Folder structure

See the project tree in the chat response, or `find src supabase -type f` here.

## 5. Tech stack

Next.js 14 (App Router) · React 18 · Tailwind + shadcn/ui (primitives hand-included
under `src/components/ui`, no CLI run needed) · Supabase (Postgres) · Dexie · Recharts ·
react-hook-form + zod · `@ducanh2912/next-pwa`.
