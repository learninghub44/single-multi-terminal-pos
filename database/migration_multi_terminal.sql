-- Multi-Terminal Support Migration
-- Run this in Supabase SQL Editor AFTER the existing schema

-- 1. Create terminals table
CREATE TABLE IF NOT EXISTS terminals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  terminal_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create cash_sessions table
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  terminal_id UUID NOT NULL REFERENCES terminals(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(12,2) DEFAULT 0,
  actual_cash NUMERIC(12,2),
  difference NUMERIC(12,2),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- 3. Add terminal_id to sales (nullable for existing records)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES terminals(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL;

-- 4. Add terminal_id to payments (nullable for existing records)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES terminals(id) ON DELETE SET NULL;

-- 5. Add terminal_id to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES terminals(id) ON DELETE SET NULL;

-- 6. Indexes for terminal queries
CREATE INDEX IF NOT EXISTS idx_terminals_code ON terminals(terminal_code);
CREATE INDEX IF NOT EXISTS idx_terminals_status ON terminals(status);

CREATE INDEX IF NOT EXISTS idx_sales_terminal_id ON sales(terminal_id);
CREATE INDEX IF NOT EXISTS idx_sales_cash_session_id ON sales(cash_session_id);

CREATE INDEX IF NOT EXISTS idx_payments_terminal_id ON payments(terminal_id);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_terminal_id ON cash_sessions(terminal_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_id ON cash_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_terminal_id ON audit_logs(terminal_id);

-- 7. Enable RLS for new tables
ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON terminals FOR ALL USING (true);
CREATE POLICY "Service role full access" ON cash_sessions FOR ALL USING (true);

-- 8. Trigger for terminals updated_at
CREATE TRIGGER update_terminals_updated_at BEFORE UPDATE ON terminals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Create atomic stock deduction function (prevents race conditions)
CREATE OR REPLACE FUNCTION deduct_stock_atomically(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_current_stock INTEGER;
  v_new_stock INTEGER;
BEGIN
  -- Lock the product row and get current stock
  SELECT stock_quantity INTO v_current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_stock, p_quantity;
  END IF;

  v_new_stock := v_current_stock - p_quantity;

  UPDATE products
  SET stock_quantity = v_new_stock,
      updated_at = NOW()
  WHERE id = p_product_id;

  RETURN v_new_stock;
END;
$$ LANGUAGE plpgsql;

-- 10. Create unique receipt number function (prevents duplicates under concurrency)
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  v_next_num INTEGER;
  v_receipt TEXT;
BEGIN
  -- Use a advisory lock to prevent concurrent receipt number generation
  PERFORM pg_advisory_xact_lock(hashtext('receipt_number'));

  SELECT COALESCE(MAX(
    CAST(REPLACE(receipt_number, 'RCT-', '') AS INTEGER)
  ), 0) + 1
  INTO v_next_num
  FROM sales;

  v_receipt := 'RCT-' || LPAD(v_next_num::TEXT, 6, '0');
  RETURN v_receipt;
END;
$$ LANGUAGE plpgsql;

-- Insert default terminals (optional - can be done via UI)
INSERT INTO terminals (terminal_code, name, location) VALUES
  ('POS-01', 'Counter 1', 'Main Entrance')
ON CONFLICT (terminal_code) DO NOTHING;
