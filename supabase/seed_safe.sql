-- ============================================================
-- G&K SHOP TRACKER — SAFE RE-RUNNABLE SEED DATA
-- ============================================================
-- Uses ON CONFLICT DO NOTHING throughout so running this
-- multiple times never causes duplicate key errors.
-- ============================================================

-- ---------- Default Udhaar fallback customer ----------
insert into customers (name, is_unspecified)
select 'Unspecified / Walk-in Credit', true
where not exists (select 1 from customers where is_unspecified = true);

-- ---------- Products ----------
insert into products (product_id, name, upc_barcode, category, unit, cost_price, selling_price, reorder_level, current_stock)
values
  ('P001', 'Basmati Rice Premium 1Kg',      '89033291123', 'Staples (Atta, Rice, Oil)',        'Kg',   80, 105,  20, 0),
  ('P002', 'Refined Mustard Oil 1L',        null,          'Staples (Atta, Rice, Oil)',        'Pack', 140, 165, 120, 0),
  ('P003', 'Whole Wheat Atta 5Kg',          '89033295678', 'Staples (Atta, Rice, Oil)',        'Pack', 210, 250, 10, 0),
  ('P004', 'Premium Tea Blend 250g',        null,          'Beverages (Tea, Coffee, Juices)',  'Pack', 90, 115,  45, 0),
  ('P005', 'Instant Coffee 100g',           '89033291735', 'Beverages (Tea, Coffee, Juices)',  'Pc',   140, 185, 25, 0),
  ('P006', 'Masala Chai Tea Bags 50s',      null,          'Beverages (Tea, Coffee, Juices)',  'Pack', 95, 120,  12, 0),
  ('P007', 'Instant Noodles Pack',          null,          'Snacks & Packaged Foods',          'Pc',   12, 15, 200, 0),
  ('P008', 'Chocolate Chip Cookies',        null,          'Snacks & Packaged Foods',          'Pc',   30, 40,  40, 0),
  ('P009', 'Tomato Ketchup 500g',           null,          'Snacks & Packaged Foods',          'Pc',   75, 95,  15, 0),
  ('P010', 'Antiseptic Liquid Handwash',    null,          'Personal Care (Soaps, Shampoos)',  'Pc',   85, 105, 30, 0),
  ('P011', 'Sandalwood Beauty Soap',        '89033297824', 'Personal Care (Soaps, Shampoos)',  'Pc',   34, 45,  30, 0),
  ('P012', 'Herbal Total Care Toothpaste',  null,          'Personal Care (Soaps, Shampoos)',  'Pc',   65, 85,  25, 0),
  ('P013', 'Dishwashing Liquid 500ml',      null,          'Household Supplies (Cleaners)',    'Pc',   70, 90,  15, 0),
  ('P014', 'Floor Cleaner 1L',              null,          'Household Supplies (Cleaners)',    'Pc',   55, 75,  20, 0),
  ('P015', 'Refined Sunflower Oil 1L',      '89033291455', 'Staples (Atta, Rice, Oil)',        'Pack', 110, 135, 15, 0),
  ('P016', 'Sunsilk Shampoo',               null,          'Personal Care (Soaps, Shampoos)',  'Pc',   130, 180, 20, 0)
on conflict (product_id) do nothing;

-- ---------- Purchases ----------
insert into purchases (purchase_date, product_id, supplier_name, qty, unit_cost, payment_status)
values
  ('2026-06-01', 'P001', 'Anand Distributors',        100, 80,  'Paid'),
  ('2026-06-01', 'P015', 'Anand Distributors',         50, 110, 'Paid'),
  ('2026-06-02', 'P003', 'Guwahati Mega Wholesalers',  40, 210, 'Paid'),
  ('2026-06-02', 'P005', 'East India FMCG Corp',       30, 140, 'Paid'),
  ('2026-06-03', 'P011', 'Aroma Consumer Goods',       60, 34,  'Paid')
on conflict (client_uuid) do nothing;

-- ---------- Expenses ----------
insert into expenses (expense_date, category, description, amount, payment_mode)
values
  ('2026-06-01', 'Rent',             'Monthly shop floor lease payment',   12000, 'Bank Transfer'),
  ('2026-06-01', 'Electricity',      'Commercial meter power bill - May',   2400, 'UPI'),
  ('2026-06-07', 'Staff Salary',     'Store helper monthly wages',          8500, 'Cash'),
  ('2026-06-10', 'Wastage / Expiry', 'Damaged packaged dairy goods',         680, 'N/A'),
  ('2026-06-10', 'Wastage / Expiry', 'Expired dairy products block',         450, 'N/A'),
  ('2026-06-12', 'Packaging',        'Biodegradable carry bags purchase',   1200, 'Cash'),
  ('2026-06-12', 'Miscellaneous',    'Stationery & store supplies',          350, 'Cash')
on conflict (client_uuid) do nothing;

-- ---------- Sales ----------
insert into sales (sale_date, entry_mode, cash_amount, upi_amount, credit_amount, remarks)
values
  ('2026-06-01', 'eod_summary', 8500,  12400, 1500, 'Smooth day; staples highly moving'),
  ('2026-06-02', 'eod_summary', 9200,  14100, 800,  'Weekend spike in snacks & beverages'),
  ('2026-06-03', 'eod_summary', 7100,  11000, 2100, 'Higher credit requests from local regulars'),
  ('2026-06-04', 'eod_summary', 8800,  13500, 500,  'High UPI transactions'),
  ('2026-06-05', 'eod_summary', 10400, 16200, 1200, 'Stock replenishment day; high footfall'),
  ('2026-06-06', 'eod_summary', 5600,  4500,  670,  null),
  ('2026-06-13', 'eod_summary', 5500,  3200,  200,  'Reconstructed from corrupted serial-date row')
on conflict (client_uuid) do nothing;
