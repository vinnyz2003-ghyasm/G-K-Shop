-- ============================================================
-- FILTERED P&L RPC — SAFE RE-RUNNABLE
-- ============================================================
-- Why this exists: the dashboard's new time-frame filter needs P&L totals
-- for an arbitrary date range, but v_pnl_summary (0001_init_safe.sql) is a
-- fixed all-time view with no parameters. The dashboard code worked around
-- that by pulling every matching sales/purchases/expenses row over the wire
-- and summing them in JavaScript — which works, but PostgREST caps rows
-- per request (1000 by default). Once a selected range matches more rows
-- than that cap, the JS sum silently under-reports with no error. This
-- function does the same SUM()/COUNT() v_pnl_summary already does, just
-- parameterized by date range and computed in Postgres — no row cap applies
-- to an aggregate computed server-side, since only the final totals (one
-- row) cross the network either way.
--
-- Run this in Supabase SQL Editor → click Run. Safe to re-run.
-- After running, regenerate src/lib/supabase/database.types.ts:
--   npm run db:types
-- (a hand-written stub for this function's types ships alongside this in
-- the same patch, so the app compiles correctly before you do that too).
-- ============================================================

create or replace function fn_filtered_pnl(p_from date, p_to date)
returns table (
  cash            numeric,
  upi             numeric,
  credit          numeric,
  gross_revenue   numeric,
  cogs            numeric,
  total_expenses  numeric,
  active_credit   numeric,
  net_profit      numeric,
  sale_count      bigint
)
language sql
stable
security invoker
as $$
  with rev as (
    select coalesce(sum(cash_amount), 0)   as cash,
           coalesce(sum(upi_amount), 0)    as upi,
           coalesce(sum(credit_amount), 0) as credit,
           coalesce(sum(total_revenue), 0) as gross_revenue,
           count(*)                        as sale_count
      from sales
     where sale_date >= p_from and sale_date <= p_to
  ),
  cogs as (
    select coalesce(sum(total_amount), 0) as cogs
      from purchases
     where payment_status = 'Paid'
       and purchase_date >= p_from and purchase_date <= p_to
  ),
  exp as (
    select coalesce(sum(amount), 0) as total_expenses
      from expenses
     where expense_date >= p_from and expense_date <= p_to
  ),
  -- Outstanding credit is deliberately NOT date-filtered (it's "how much
  -- should I be collecting right now", not scoped to the selected period)
  -- — same as the old JS version and v_pnl_summary before it.
  active_credit as (
    select coalesce(sum(outstanding_balance), 0) as active_credit
      from v_customer_balances
     where outstanding_balance > 0
  )
  select rev.cash, rev.upi, rev.credit, rev.gross_revenue,
         cogs.cogs,
         exp.total_expenses,
         active_credit.active_credit,
         (rev.gross_revenue - cogs.cogs - exp.total_expenses) as net_profit,
         rev.sale_count
    from rev, cogs, exp, active_credit;
$$;

-- security invoker (the default, made explicit above) means this runs as
-- the calling user and is still subject to RLS on sales/purchases/expenses —
-- it does not bypass row-level security, it just aggregates inside Postgres
-- instead of pulling raw rows out first. Matches the existing "authenticated
-- full access" policy: only logged-in users can call this.
grant execute on function fn_filtered_pnl(date, date) to authenticated;
