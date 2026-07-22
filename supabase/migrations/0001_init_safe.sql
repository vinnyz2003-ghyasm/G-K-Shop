-- ============================================================
-- G&K SHOP TRACKER — SAFE RE-RUNNABLE SCHEMA
-- ============================================================
-- This version uses IF NOT EXISTS and OR REPLACE throughout
-- so it can be run multiple times without errors.
-- Run this in Supabase SQL Editor → click Run
-- ============================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "pgcrypto";

-- ---------- ENUMS (safe re-run using DO blocks) ----------
do $$ begin
  create type payment_status as enum ('Paid', 'Pending');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_mode as enum ('Cash', 'UPI', 'Bank Transfer', 'Card', 'N/A');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type expense_category as enum (
    'Rent', 'Electricity', 'Staff Salary', 'Wastage / Expiry',
    'Packaging', 'Miscellaneous', 'Transport', 'Maintenance'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type udhaar_entry_type as enum ('Credit Given', 'Payment Received');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists products (
  product_id        text primary key,
  name              text not null,
  upc_barcode       text unique,
  category          text not null,
  unit              text not null default 'Pc',
  cost_price        numeric(12,2) not null check (cost_price >= 0),
  selling_price     numeric(12,2) not null check (selling_price >= 0),
  reorder_level     integer not null default 10 check (reorder_level >= 0),
  current_stock     integer not null default 0 check (current_stock >= 0),
  profit_per_unit   numeric(12,2) generated always as (selling_price - cost_price) stored,
  margin_percentage numeric(6,2) generated always as (
                      case when selling_price = 0 then 0
                      else round(((selling_price - cost_price) / selling_price) * 100, 2)
                      end
                    ) stored,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists customers (
  customer_id    uuid primary key default gen_random_uuid(),
  name           text not null,
  phone          text,
  is_unspecified boolean not null default false,
  created_at     timestamptz not null default now()
);

create unique index if not exists idx_customers_one_unspecified
  on customers (is_unspecified) where is_unspecified = true;

create table if not exists sales (
  transaction_id  uuid primary key default gen_random_uuid(),
  client_uuid     uuid unique not null default gen_random_uuid(),
  sale_date       date not null default (now() at time zone 'Asia/Kolkata')::date
                    check (sale_date <= (now() at time zone 'Asia/Kolkata')::date),
  entry_mode      text not null default 'eod_summary'
                    check (entry_mode in ('eod_summary', 'itemized')),
  cash_amount     numeric(12,2) not null default 0 check (cash_amount >= 0),
  upi_amount      numeric(12,2) not null default 0 check (upi_amount >= 0),
  credit_amount   numeric(12,2) not null default 0 check (credit_amount >= 0),
  total_revenue   numeric(12,2) generated always as (cash_amount + upi_amount + credit_amount) stored,
  customer_id     uuid references customers (customer_id),
  remarks         text,
  synced_at       timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists sale_items (
  sale_item_id   uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references sales (transaction_id) on delete cascade,
  product_id     text not null references products (product_id),
  qty            integer not null check (qty > 0),
  unit_price     numeric(12,2) not null check (unit_price >= 0),
  unit_cost      numeric(12,2),
  line_total     numeric(12,2) generated always as (qty * unit_price) stored
);

create table if not exists udhaar_transactions (
  udhaar_id      uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers (customer_id),
  transaction_id uuid references sales (transaction_id),
  entry_type     udhaar_entry_type not null,
  amount         numeric(12,2) not null check (amount > 0),
  entry_date     date not null default (now() at time zone 'Asia/Kolkata')::date,
  notes          text,
  created_at     timestamptz not null default now()
);

create table if not exists purchases (
  purchase_id    uuid primary key default gen_random_uuid(),
  client_uuid    uuid unique not null default gen_random_uuid(),
  purchase_date  date not null default (now() at time zone 'Asia/Kolkata')::date
                   check (purchase_date <= (now() at time zone 'Asia/Kolkata')::date),
  product_id     text not null references products (product_id),
  supplier_name  text not null,
  qty            integer not null check (qty > 0),
  unit_cost      numeric(12,2) not null check (unit_cost >= 0),
  total_amount   numeric(12,2) generated always as (qty * unit_cost) stored,
  payment_status payment_status not null default 'Pending',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists expenses (
  expense_id    uuid primary key default gen_random_uuid(),
  client_uuid   uuid unique not null default gen_random_uuid(),
  expense_date  date not null default (now() at time zone 'Asia/Kolkata')::date
                  check (expense_date <= (now() at time zone 'Asia/Kolkata')::date),
  category      expense_category not null,
  description   text,
  amount        numeric(12,2) not null check (amount > 0),
  payment_mode  payment_mode not null default 'Cash',
  created_at    timestamptz not null default now()
);

-- ---------- INDEXES ----------
create index if not exists idx_products_category on products (category);
create index if not exists idx_products_low_stock on products (current_stock, reorder_level);
create index if not exists idx_sales_date on sales (sale_date desc);
create index if not exists idx_sale_items_txn on sale_items (transaction_id);
create index if not exists idx_sale_items_product on sale_items (product_id);
create index if not exists idx_udhaar_customer on udhaar_transactions (customer_id);
create index if not exists idx_udhaar_date on udhaar_transactions (entry_date desc);
create index if not exists idx_purchases_date on purchases (purchase_date desc);
create index if not exists idx_purchases_status on purchases (payment_status);
create index if not exists idx_expenses_date on expenses (expense_date desc);
create index if not exists idx_expenses_category on expenses (category);

-- ============================================================
-- FUNCTIONS & TRIGGERS (CREATE OR REPLACE — always safe)
-- ============================================================

create or replace function fn_snapshot_unit_cost()
returns trigger as $$
begin
  if new.unit_cost is null then
    select cost_price into new.unit_cost from products where product_id = new.product_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_snapshot_unit_cost on sale_items;
create trigger trg_snapshot_unit_cost
  before insert on sale_items
  for each row execute function fn_snapshot_unit_cost();

create or replace function fn_decrement_stock_on_sale_item()
returns trigger as $$
begin
  update products
     set current_stock = current_stock - new.qty,
         updated_at = now()
   where product_id = new.product_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_decrement_stock_on_sale_item on sale_items;
create trigger trg_decrement_stock_on_sale_item
  after insert on sale_items
  for each row execute function fn_decrement_stock_on_sale_item();

create or replace function fn_restock_on_sale_item_delete()
returns trigger as $$
begin
  update products
     set current_stock = current_stock + old.qty,
         updated_at = now()
   where product_id = old.product_id;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_restock_on_sale_item_delete on sale_items;
create trigger trg_restock_on_sale_item_delete
  after delete on sale_items
  for each row execute function fn_restock_on_sale_item_delete();

create or replace function fn_adjust_stock_on_purchase()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.payment_status = 'Paid' then
      update products set current_stock = current_stock + new.qty, updated_at = now()
       where product_id = new.product_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.payment_status <> 'Paid' and new.payment_status = 'Paid' then
      update products set current_stock = current_stock + new.qty, updated_at = now()
       where product_id = new.product_id;
    elsif old.payment_status = 'Paid' and new.payment_status <> 'Paid' then
      update products set current_stock = current_stock - new.qty, updated_at = now()
       where product_id = new.product_id;
    elsif old.payment_status = 'Paid' and new.payment_status = 'Paid' and old.qty <> new.qty then
      update products set current_stock = current_stock + (new.qty - old.qty), updated_at = now()
       where product_id = new.product_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_adjust_stock_on_purchase on purchases;
create trigger trg_adjust_stock_on_purchase
  after insert or update on purchases
  for each row execute function fn_adjust_stock_on_purchase();

create or replace function fn_post_credit_to_udhaar()
returns trigger as $$
declare
  v_customer_id uuid;
begin
  if new.credit_amount > 0 then
    v_customer_id := new.customer_id;
    if v_customer_id is null then
      select customer_id into v_customer_id from customers where is_unspecified = true limit 1;
    end if;
    insert into udhaar_transactions (customer_id, transaction_id, entry_type, amount, entry_date, notes)
    values (v_customer_id, new.transaction_id, 'Credit Given', new.credit_amount, new.sale_date,
            'Auto-posted from sale ' || new.transaction_id);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_post_credit_to_udhaar on sales;
create trigger trg_post_credit_to_udhaar
  after insert on sales
  for each row execute function fn_post_credit_to_udhaar();

create or replace function fn_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_products on products;
create trigger trg_touch_products before update on products for each row execute function fn_touch_updated_at();

drop trigger if exists trg_touch_purchases on purchases;
create trigger trg_touch_purchases before update on purchases for each row execute function fn_touch_updated_at();

-- ============================================================
-- VIEWS
-- ============================================================

create or replace view v_low_stock_alerts as
  select product_id, name, category, unit, current_stock, reorder_level,
         (reorder_level - current_stock) as units_short
    from products
   where is_active and current_stock <= reorder_level
   order by units_short desc;

create or replace view v_customer_balances as
  select c.customer_id, c.name, c.phone, c.is_unspecified,
         coalesce(sum(case when ut.entry_type = 'Credit Given'     then ut.amount else 0 end), 0)
       - coalesce(sum(case when ut.entry_type = 'Payment Received' then ut.amount else 0 end), 0)
         as outstanding_balance
    from customers c
    left join udhaar_transactions ut on ut.customer_id = c.customer_id
   group by c.customer_id, c.name, c.phone, c.is_unspecified;

create or replace view v_daily_sales_vs_expenses as
  select d.day,
         coalesce(s.revenue, 0) as revenue,
         coalesce(e.expenses, 0) as expenses
    from (select generate_series(
            (now() at time zone 'Asia/Kolkata')::date - interval '29 days',
            (now() at time zone 'Asia/Kolkata')::date,
            interval '1 day')::date as day) d
    left join (select sale_date as day, sum(total_revenue) as revenue
                 from sales group by sale_date) s on s.day = d.day
    left join (select expense_date as day, sum(amount) as expenses
                 from expenses group by expense_date) e on e.day = d.day
   order by d.day;

create or replace view v_pnl_summary as
  with rev as (
    select coalesce(sum(cash_amount), 0)   as cash,
           coalesce(sum(upi_amount), 0)    as upi,
           coalesce(sum(credit_amount), 0) as credit,
           coalesce(sum(total_revenue), 0) as gross_revenue
      from sales
  ),
  cogs as (
    select coalesce(sum(total_amount), 0) as cogs
      from purchases where payment_status = 'Paid'
  ),
  exp as (
    select coalesce(sum(amount), 0) as total_expenses from expenses
  ),
  active_credit as (
    select coalesce(sum(outstanding_balance), 0) as active_credit
      from v_customer_balances where outstanding_balance > 0
  )
  select rev.cash, rev.upi, rev.credit, rev.gross_revenue,
         cogs.cogs,
         exp.total_expenses,
         active_credit.active_credit,
         (rev.gross_revenue - cogs.cogs - exp.total_expenses) as net_profit
    from rev, cogs, exp, active_credit;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table products            enable row level security;
alter table customers           enable row level security;
alter table sales               enable row level security;
alter table sale_items          enable row level security;
alter table udhaar_transactions enable row level security;
alter table purchases           enable row level security;
alter table expenses            enable row level security;

-- Drop existing policies first to avoid "already exists" errors
drop policy if exists "Authenticated full access" on products;
drop policy if exists "Authenticated full access" on customers;
drop policy if exists "Authenticated full access" on sales;
drop policy if exists "Authenticated full access" on sale_items;
drop policy if exists "Authenticated full access" on udhaar_transactions;
drop policy if exists "Authenticated full access" on purchases;
drop policy if exists "Authenticated full access" on expenses;

create policy "Authenticated full access" on products            for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access" on customers           for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access" on sales               for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access" on sale_items          for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access" on udhaar_transactions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access" on purchases           for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access" on expenses            for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table sales, purchases, expenses, products;
