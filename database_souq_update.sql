-- ==========================================
-- SOUQ & BRANCH INVENTORY UPDATES
-- Run this in Supabase SQL Editor
-- ==========================================

-- 1. Add columns to products and out_of_stock_products
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_product_id UUID;

ALTER TABLE out_of_stock_products 
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_product_id UUID;

-- 2. Orders also need branch_id to filter branch orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;

-- Note: The trigger `move_product_on_stock_change` automatically 
-- handles the new columns because it uses SELECT (NEW).*
