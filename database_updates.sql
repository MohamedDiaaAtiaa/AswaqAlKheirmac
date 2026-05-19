-- ==========================================
-- GUEST CHECKOUT RLS POLICIES UPDATE
-- Run these commands in Supabase SQL Editor to allow guest checkout
-- ==========================================

-- 1. Orders Table: Allow guests to insert orders and view their own orders
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can create orders" ON orders;
CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);


-- 2. Order Items Table: Allow guests to insert items and view items for their orders
DROP POLICY IF EXISTS "Anyone can view order items for their orders" ON order_items;
CREATE POLICY "Anyone can view order items for their orders"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL OR check_is_admin())
    )
  );

DROP POLICY IF EXISTS "Users can insert order items" ON order_items;
CREATE POLICY "Users can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );

-- ==========================================
-- ADD MISSING COLUMNS TO ORDERS TABLE
-- Run this if you are getting PGRST204 "Could not find the 'customer_address' column"
-- ==========================================
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT;
  
-- Also remove the old delivery_address if it exists
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_address;
