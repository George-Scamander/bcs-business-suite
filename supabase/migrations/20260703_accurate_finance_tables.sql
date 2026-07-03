-- Accurate Online 財務數據同步表

-- 銷售發票表
CREATE TABLE IF NOT EXISTS accurate_sales_invoices (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL,
  customer_name TEXT,
  customer_id TEXT,
  branch_name TEXT,
  transaction_date DATE,
  due_date DATE,
  total_amount NUMERIC(18, 2),
  tax_amount NUMERIC(18, 2),
  paid_amount NUMERIC(18, 2),
  outstanding_amount NUMERIC(18, 2),
  status TEXT,
  currency_code TEXT DEFAULT 'IDR',
  note TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 採購發票表
CREATE TABLE IF NOT EXISTS accurate_purchase_invoices (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL,
  vendor_name TEXT,
  vendor_id TEXT,
  branch_name TEXT,
  transaction_date DATE,
  due_date DATE,
  total_amount NUMERIC(18, 2),
  tax_amount NUMERIC(18, 2),
  paid_amount NUMERIC(18, 2),
  outstanding_amount NUMERIC(18, 2),
  status TEXT,
  currency_code TEXT DEFAULT 'IDR',
  note TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 庫存數據表
CREATE TABLE IF NOT EXISTS accurate_inventory_items (
  id TEXT PRIMARY KEY,
  item_code TEXT,
  item_name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  stock_quantity NUMERIC(18, 4),
  min_stock NUMERIC(18, 4),
  buy_price NUMERIC(18, 2),
  sell_price NUMERIC(18, 2),
  warehouse_name TEXT,
  branch_name TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backorder（待交貨銷售訂單）表
CREATE TABLE IF NOT EXISTS accurate_backorders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL,
  customer_name TEXT,
  customer_id TEXT,
  branch_name TEXT,
  transaction_date DATE,
  expected_delivery_date DATE,
  item_name TEXT,
  item_code TEXT,
  ordered_quantity NUMERIC(18, 4),
  delivered_quantity NUMERIC(18, 4),
  remaining_quantity NUMERIC(18, 4),
  unit TEXT,
  unit_price NUMERIC(18, 2),
  total_amount NUMERIC(18, 2),
  status TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 現金流記錄表
CREATE TABLE IF NOT EXISTS accurate_cash_flow (
  id TEXT PRIMARY KEY,
  transaction_date DATE NOT NULL,
  description TEXT,
  account_name TEXT,
  account_code TEXT,
  branch_name TEXT,
  debit_amount NUMERIC(18, 2) DEFAULT 0,
  credit_amount NUMERIC(18, 2) DEFAULT 0,
  balance NUMERIC(18, 2),
  transaction_type TEXT,
  reference_no TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同步日誌表（記錄每次同步的狀態）
CREATE TABLE IF NOT EXISTS accurate_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_accurate_sales_invoices_date ON accurate_sales_invoices(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_accurate_sales_invoices_customer ON accurate_sales_invoices(customer_name);
CREATE INDEX IF NOT EXISTS idx_accurate_sales_invoices_status ON accurate_sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_accurate_purchase_invoices_date ON accurate_purchase_invoices(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_accurate_inventory_items_code ON accurate_inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_accurate_backorders_date ON accurate_backorders(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_accurate_backorders_status ON accurate_backorders(status);
CREATE INDEX IF NOT EXISTS idx_accurate_cash_flow_date ON accurate_cash_flow(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_accurate_sync_logs_type ON accurate_sync_logs(sync_type, started_at DESC);

-- RLS: 只允許已登錄用戶查看（read-only，寫入由後端腳本使用 service_role key）
ALTER TABLE accurate_sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE accurate_purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE accurate_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE accurate_backorders ENABLE ROW LEVEL SECURITY;
ALTER TABLE accurate_cash_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE accurate_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read accurate_sales_invoices"
  ON accurate_sales_invoices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read accurate_purchase_invoices"
  ON accurate_purchase_invoices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read accurate_inventory_items"
  ON accurate_inventory_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read accurate_backorders"
  ON accurate_backorders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read accurate_cash_flow"
  ON accurate_cash_flow FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read accurate_sync_logs"
  ON accurate_sync_logs FOR SELECT TO authenticated USING (true);
