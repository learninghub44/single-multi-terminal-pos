-- Manual Payment + Payment Integrity Fixes Migration
-- Run this in Supabase SQL Editor AFTER schema.sql and migration_multi_terminal.sql
--
-- What this fixes:
--   1. Adds a 'manual' payment method for shops without M-Pesa/PayHero API
--      integration (till number confirmed by the cashier).
--   2. Adds restore_stock_atomically() so stock is put back when a mobile
--      money payment fails, times out, or is cancelled (previously stock
--      was deducted immediately and NEVER restored on failure).
--   3. Tracks who confirmed a manual/mpesa/payhero payment for audit purposes.
--   4. Adds an expiry timestamp so stale "pending" mobile payments can be
--      swept automatically instead of leaving stock locked up forever.
--   5. Fixes a lost-update race in manual stock adjustments (adjust_stock_atomically).
--   6. Fixes the low-stock report, which was comparing a column against a
--      literal string instead of another column (get_low_stock_products).
--   7. Adds till/paybill fields to business_settings so shops without API
--      payment integration configure their number once instead of the
--      cashier remembering/typing it every sale.
--
-- This file is safe to re-run - every statement uses IF NOT EXISTS / CREATE
-- OR REPLACE, so running it again (e.g. after section 7 was added) only
-- applies whatever's new.

-- 1. Allow 'manual' as a payment method/provider
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('cash', 'mpesa', 'payhero', 'manual'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE payments ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('cash', 'mpesa', 'payhero', 'manual'));

-- 2. Track who manually confirmed a payment (cashier accountability)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Expiry for pending mobile-money payments (used to auto-cancel + restock)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payments_expires_at ON payments(expires_at) WHERE status = 'pending';

-- 4. Atomic stock restoration (mirror of deduct_stock_atomically)
CREATE OR REPLACE FUNCTION restore_stock_atomically(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_new_stock INTEGER;
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id
  RETURNING stock_quantity INTO v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  RETURN v_new_stock;
END;
$$ LANGUAGE plpgsql;

-- 5. Atomic manual stock adjustment (purchase/return/damage/opening_stock/
-- adjustment). Replaces the previous read-stock-in-JS-then-write-it-back
-- pattern in POST /api/inventory/adjust, which was a classic lost-update
-- race: two concurrent adjustments (or an adjustment racing a sale's own
-- atomic deduction) could both read the same starting stock and the second
-- write would silently overwrite the first instead of stacking on top of it.
-- p_delta is signed: positive for purchase/return/opening_stock, negative
-- for damage/adjustment - the caller decides the sign, this function just
-- applies it atomically and enforces the floor of zero.
CREATE OR REPLACE FUNCTION adjust_stock_atomically(
  p_product_id UUID,
  p_delta INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_new_stock INTEGER;
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + p_delta,
      updated_at = NOW()
  WHERE id = p_product_id
  RETURNING stock_quantity INTO v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot go below zero (would be %)', v_new_stock;
  END IF;

  RETURN v_new_stock;
END;
$$ LANGUAGE plpgsql;

-- 6. Low-stock lookup as a proper function, comparing stock_quantity against
-- each product's own low_stock_threshold. The route this replaces used
-- supabase-js's .filter('stock_quantity', 'lte', 'low_stock_threshold'),
-- which passes 'low_stock_threshold' as a literal string value to compare
-- against - not a reference to the other column - so it was never actually
-- comparing the two columns against each other.
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS SETOF products AS $$
  SELECT * FROM products
  WHERE status = 'active'
    AND stock_quantity <= low_stock_threshold
  ORDER BY stock_quantity ASC;
$$ LANGUAGE sql STABLE;

-- 7. Manual payment details, configured once in Settings instead of the
-- cashier having to remember/type the till or paybill number every sale.
-- Shown automatically on the manual-checkout screen and on receipts.
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS till_number TEXT;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS paybill_number TEXT;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS paybill_account_name TEXT;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS manual_payment_instructions TEXT;
