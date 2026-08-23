-- Atomic Sale Creation Migration
-- Run this AFTER migration_manual_payment_and_fixes.sql
--
-- What this fixes:
--   POST /api/sales previously ran as ~6 separate network round-trips
--   (insert sale -> insert sale_items -> insert payment -> N separate stock
--   deductions), each hitting Supabase independently, with manual delete()
--   calls to "roll back" earlier steps if a later one failed. Each RPC call
--   is its own transaction - the sequence as a whole was never atomic. If
--   the Worker was killed mid-sequence (CPU/wall-time limit, a dropped
--   connection, a Supabase blip), a sale could end up half-written: stock
--   deducted with no payment record, or a payment row with no matching
--   sale_items. Concurrent checkouts on the same product could also both
--   pass the initial stock check before either had deducted, since the
--   check and the deduction were separate round-trips.
--
--   This wraps sale creation into one Postgres function, so it runs as one
--   real transaction (row locks on the affected products for the whole
--   duration): either everything commits, or none of it does, and no two
--   concurrent sales can oversell the same stock.

CREATE OR REPLACE FUNCTION create_sale_atomically(
  p_receipt_number TEXT,
  p_customer_id UUID,
  p_user_id UUID,
  p_terminal_id UUID,
  p_cash_session_id UUID,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_tax NUMERIC,
  p_total NUMERIC,
  p_status TEXT,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_payment_phone TEXT,
  -- Array of {product_id, product_name_snapshot, quantity, unit_price, buying_price_snapshot, subtotal}
  p_items JSONB
) RETURNS JSONB AS $$
DECLARE
  v_sale_id UUID;
  v_payment_id UUID;
  v_item JSONB;
  v_product RECORD;
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart cannot be empty';
  END IF;

  -- Validate every item first, locking each product row for the rest of
  -- this transaction (FOR UPDATE) so a concurrent sale on the same product
  -- has to wait rather than both passing the check simultaneously.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, name, stock_quantity, status INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;

    IF v_product.status != 'active' THEN
      RAISE EXCEPTION 'Product is archived: %', v_product.name;
    END IF;

    IF v_product.stock_quantity < (v_item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION 'Insufficient stock for %. Available: %', v_product.name, v_product.stock_quantity;
    END IF;
  END LOOP;

  INSERT INTO sales (receipt_number, customer_id, user_id, terminal_id, cash_session_id, subtotal, discount, tax, total, status)
  VALUES (p_receipt_number, p_customer_id, p_user_id, p_terminal_id, p_cash_session_id, p_subtotal, p_discount, p_tax, p_total, p_status)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (sale_id, product_id, product_name_snapshot, quantity, unit_price, buying_price_snapshot, subtotal)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name_snapshot',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'buying_price_snapshot')::NUMERIC,
      (v_item->>'subtotal')::NUMERIC
    );

    UPDATE products
    SET stock_quantity = stock_quantity - (v_item->>'quantity')::INTEGER,
        updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID;

    INSERT INTO inventory_movements (product_id, type, quantity, reference, notes, user_id)
    VALUES (
      (v_item->>'product_id')::UUID,
      'sale',
      -(v_item->>'quantity')::INTEGER,
      v_sale_id,
      'Sale ' || p_receipt_number,
      p_user_id
    );
  END LOOP;

  INSERT INTO payments (sale_id, method, provider, amount, status, phone, terminal_id)
  VALUES (v_sale_id, p_payment_method, p_payment_method, p_total, p_payment_status, p_payment_phone, p_terminal_id)
  RETURNING id INTO v_payment_id;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, terminal_id, metadata)
  VALUES (
    p_user_id,
    'SALE_CREATED',
    'sale',
    v_sale_id,
    p_terminal_id,
    jsonb_build_object('receipt_number', p_receipt_number, 'total', p_total, 'payment_method', p_payment_method)
  );

  RETURN jsonb_build_object('sale_id', v_sale_id, 'payment_id', v_payment_id);
END;
$$ LANGUAGE plpgsql;
