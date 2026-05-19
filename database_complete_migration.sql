-- ============================================================
-- أسواق الخير (Aswaq Al Kheir) — Complete Database Migration
-- Includes branch auth, product images, sales fixes, and main admin
-- Run this in Supabase SQL Editor
-- ============================================================

-- =====================
-- 1. BRANCH AUTHENTICATION
-- =====================
ALTER TABLE branches ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN branches.username IS 'Branch admin username for mobile app login';
COMMENT ON COLUMN branches.password_hash IS 'Hashed password for branch admin authentication';

-- =====================
-- 2. PRODUCT IMAGES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage product images" ON product_images
  USING (public.check_is_admin() = true)
  WITH CHECK (public.check_is_admin() = true);

-- =====================
-- 3. STORAGE BUCKET FOR PRODUCT IMAGES
-- =====================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.check_is_admin() = true);

CREATE POLICY "Anyone can view product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Admins can delete product images" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND public.check_is_admin() = true);

-- =====================
-- 4. UPDATE BRANCH SALES TABLE
-- =====================
-- Rename columns to match requirements
ALTER TABLE branch_sales RENAME COLUMN quantity TO weight;
ALTER TABLE branch_sales RENAME COLUMN count TO amount;
ALTER TABLE branch_sales RENAME COLUMN sales_level TO commission_and_meshal;

-- Add total column
ALTER TABLE branch_sales ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0;

-- Update total calculation (price * weight + commission_and_meshal)
UPDATE branch_sales SET total = (price * weight) + commission_and_meshal WHERE total = 0;

-- =====================
-- 5. INSERT MAIN ADMIN BRANCH
-- =====================
INSERT INTO branches (name, name_en, username, password_hash, is_active, is_default)
VALUES ('السوق الرئيسي', 'Main Souq', 'Main', 'Password', true, true)
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    is_active = EXCLUDED.is_active,
    is_default = EXCLUDED.is_default;

-- =====================
-- 6. UPDATE PRODUCTS TO ALLOW NULL BRANCH_ID FOR SOUQ PRODUCTS
-- =====================
-- Ensure products without branch_id are souq products
UPDATE products SET branch_id = NULL WHERE branch_id IS NOT NULL AND branch_id NOT IN (SELECT id FROM branches);

-- ============================================================
-- MIGRATION COMPLETE!
-- ============================================================