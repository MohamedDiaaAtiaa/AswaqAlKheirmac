-- ============================================================
-- MOS Logix Demo — Complete Database Schema (v2)
-- Supabase Project: ezcfulijxtfglpfarxtl
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard > SQL)
-- ============================================================

-- =====================
-- 0. EXTENSIONS
-- =====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- 1. PROFILES TABLE
-- =====================
-- Mirrors auth.users with extra app-level fields.
-- Automatically populated via trigger on auth.users INSERT.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =====================
-- 2. PRODUCTS TABLE (Bilingual)
-- =====================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Bilingual name fields
  name TEXT NOT NULL,               -- Primary name (Arabic by default)
  name_ar TEXT,                     -- Arabic product name
  name_en TEXT,                     -- English product name
  -- Bilingual description fields
  description TEXT,                 -- Primary description (Arabic by default)
  description_ar TEXT,              -- Arabic description
  description_en TEXT,              -- English description
  -- Other fields
  category TEXT NOT NULL DEFAULT 'general',
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  parent_product_id UUID, -- References the Souq product it was taken from
  emoji TEXT DEFAULT '🛒',
  badge TEXT,
  image_url TEXT,
  sizes JSONB NOT NULL DEFAULT '[{"label":"Default","price":1,"old_price":null}]'::jsonb,
  default_size INTEGER DEFAULT 0,
  stock INTEGER DEFAULT 50,
  unit TEXT DEFAULT 'item',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- =====================
-- 3. OUT-OF-STOCK PRODUCTS TABLE
-- =====================
-- Mirror of products for items with zero stock.
CREATE TABLE IF NOT EXISTS out_of_stock_products (LIKE products INCLUDING ALL);

-- =====================
-- 4. STOCK MANAGEMENT TRIGGERS
-- =====================

-- Function to move products between tables based on stock level
CREATE OR REPLACE FUNCTION move_product_on_stock_change() 
RETURNS TRIGGER AS $$
BEGIN
    -- If product in 'products' table hits 0 or less, move to 'out_of_stock_products'
    IF (TG_TABLE_NAME = 'products' AND NEW.stock <= 0) THEN
        INSERT INTO out_of_stock_products SELECT (NEW).*;
        DELETE FROM products WHERE id = NEW.id;
        RETURN NULL;
    
    -- If product in 'out_of_stock_products' is restocked (> 0), move back to 'products'
    ELSIF (TG_TABLE_NAME = 'out_of_stock_products' AND NEW.stock > 0) THEN
        INSERT INTO products SELECT (NEW).*;
        DELETE FROM out_of_stock_products WHERE id = NEW.id;
        RETURN NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_stock_out ON products;
CREATE TRIGGER tr_check_stock_out
BEFORE UPDATE OF stock ON products
FOR EACH ROW
WHEN (NEW.stock <= 0)
EXECUTE FUNCTION move_product_on_stock_change();

DROP TRIGGER IF EXISTS tr_check_stock_in ON out_of_stock_products;
CREATE TRIGGER tr_check_stock_in
BEFORE UPDATE OF stock ON out_of_stock_products
FOR EACH ROW
WHEN (NEW.stock > 0)
EXECUTE FUNCTION move_product_on_stock_change();

-- Auto-update updated_at on products
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_products_updated_at ON products;
CREATE TRIGGER tr_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_oos_products_updated_at ON out_of_stock_products;
CREATE TRIGGER tr_oos_products_updated_at
BEFORE UPDATE ON out_of_stock_products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- =====================
-- 5. ORDERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending','Preparing','Out for Delivery','Delivered','Cancelled')),
  notes TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  payment_method TEXT,
  transaction_screenshot_url TEXT,
  payment_proof_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- =====================
-- 6. ORDER ITEMS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  size_label TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Auto-reduce stock when an order item is inserted
CREATE OR REPLACE FUNCTION auto_reduce_stock_after_order()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products 
    SET stock = stock - NEW.quantity 
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_reduce_stock ON order_items;
CREATE TRIGGER tr_reduce_stock
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION auto_reduce_stock_after_order();

-- =====================
-- 7. APP SETTINGS TABLE
-- =====================
-- Key-value store for banners, categories, and other app config.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- 8. ADMIN CHECK FUNCTION (for RLS)
-- =====================
CREATE OR REPLACE FUNCTION check_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 9. ROW LEVEL SECURITY
-- =====================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (check_is_admin());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (check_is_admin());

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (check_is_admin());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  WITH CHECK (check_is_admin());

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
  USING (check_is_admin());

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  USING (check_is_admin());

-- Out of stock products
ALTER TABLE out_of_stock_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view oos products"
  ON out_of_stock_products FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage oos products"
  ON out_of_stock_products FOR ALL
  USING (check_is_admin());

-- Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  USING (check_is_admin());

CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
  USING (check_is_admin());

CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  USING (check_is_admin());

-- Order Items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view order items for their orders"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL OR check_is_admin())
    )
  );

CREATE POLICY "Users can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );

CREATE POLICY "Admins can manage order items"
  ON order_items FOR ALL
  USING (check_is_admin());

-- App Settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage app settings"
  ON app_settings FOR ALL
  USING (check_is_admin());

-- =====================
-- 10. STORAGE BUCKET
-- =====================
-- Run this manually in Dashboard > Storage > Create bucket:
-- Bucket name: product-images
-- Public: Yes
-- Or use this SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND check_is_admin());

CREATE POLICY "Anyone can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images' 
    AND (storage.foldername(name))[1] = 'receipts'
  );

CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND check_is_admin());

CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND check_is_admin());

-- =====================
-- 11. SEED DATA (Optional)
-- =====================

-- Default categories
INSERT INTO app_settings (key, value) VALUES (
  'categories',
  '[
    {"id":"dairy","label_ar":"ألبان","label_en":"Dairy","emoji":"🥛"},
    {"id":"fruits","label_ar":"فواكه","label_en":"Fruits","emoji":"🍎"},
    {"id":"vegetables","label_ar":"خضروات","label_en":"Vegetables","emoji":"🥦"},
    {"id":"meat","label_ar":"لحوم","label_en":"Meat","emoji":"🥩"},
    {"id":"bakery","label_ar":"مخبوزات","label_en":"Bakery","emoji":"🥐"},
    {"id":"beverages","label_ar":"مشروبات","label_en":"Beverages","emoji":"🥤"},
    {"id":"snacks","label_ar":"وجبات خفيفة","label_en":"Snacks","emoji":"🍿"},
    {"id":"frozen","label_ar":"مجمدات","label_en":"Frozen","emoji":"🧊"},
    {"id":"cleaning","label_ar":"تنظيف","label_en":"Cleaning","emoji":"🧹"},
    {"id":"personal_care","label_ar":"عناية شخصية","label_en":"Personal Care","emoji":"🧴"}
  ]'::jsonb
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Default empty banners
INSERT INTO app_settings (key, value) VALUES (
  'banners',
  '[]'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- DONE! Your database is ready.
-- Next step: Create an admin user via Supabase Auth,
-- then set is_admin = true in the profiles table.
-- ============================================================
