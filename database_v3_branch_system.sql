-- ============================================================
-- MOS Logix Demo — Branch System, Daily Tracking & Delivery Areas (v3)
-- Supabase Project: ezcfulijxtfglpfarxtl
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard > SQL)
-- ============================================================
-- ⚠️ Run this AFTER the base schema (database_schema.sql) is applied.
-- This script is additive — it will NOT break existing data.
-- ============================================================

-- =====================
-- 1. BRANCHES TABLE
-- =====================
-- Each branch is an independent store location.
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                    -- Branch display name (Arabic)
  name_en TEXT,                          -- Branch name (English)
  address TEXT,                          -- Physical address
  phone TEXT,                            -- Branch contact phone
  is_active BOOLEAN DEFAULT TRUE,        -- Whether branch is operational
  is_default BOOLEAN DEFAULT FALSE,      -- Default branch for new users
  settings JSONB DEFAULT '{}'::jsonb,    -- Branch-specific settings (opening hours, etc.)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one default branch
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_default ON branches (is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches (is_active);

-- Auto-update updated_at on branches
DROP TRIGGER IF EXISTS tr_branches_updated_at ON branches;
CREATE TRIGGER tr_branches_updated_at
BEFORE UPDATE ON branches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- =====================
-- 2. BRANCH DELIVERY AREAS TABLE
-- =====================
-- Per-branch delivery pricing by area/zone.
-- Each branch can define different fees for the same area.
CREATE TABLE IF NOT EXISTS branch_delivery_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  area_name TEXT NOT NULL,                 -- Area name (Arabic normalized)
  area_name_normalized TEXT,               -- Lowercase stripped name for matching
  zone_label TEXT,                         -- Optional zone grouping (e.g. "Zone 25", "Zone 30")
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Prevent duplicate areas per branch
  UNIQUE(branch_id, area_name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_bda_branch ON branch_delivery_areas(branch_id);
CREATE INDEX IF NOT EXISTS idx_bda_area_norm ON branch_delivery_areas(area_name_normalized);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS tr_bda_updated_at ON branch_delivery_areas;
CREATE TRIGGER tr_bda_updated_at
BEFORE UPDATE ON branch_delivery_areas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Normalize area name on insert/update
CREATE OR REPLACE FUNCTION normalize_area_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Strip diacritics, normalize Arabic chars, lowercase
  NEW.area_name_normalized = LOWER(TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(NEW.area_name, E'[\\u064B-\\u065F\\u0670]', '', 'g'),  -- Remove Arabic diacritics
      '\\s+', ' ', 'g'  -- Collapse whitespace
    )
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_normalize_area ON branch_delivery_areas;
CREATE TRIGGER tr_normalize_area
BEFORE INSERT OR UPDATE ON branch_delivery_areas
FOR EACH ROW
EXECUTE FUNCTION normalize_area_name();


-- =====================
-- 3. DAILY TRACKING TABLE (بياعه / مشال)
-- =====================
-- Tracks daily sold (بياعه) and removed/damaged (مشال) quantities
-- per product, per branch, per day.
CREATE TABLE IF NOT EXISTS daily_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID,                         -- NULL = custom/unlinked product entry
  product_name TEXT NOT NULL,              -- Denormalized for easy display
  tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sold_qty NUMERIC(10,2) DEFAULT 0,       -- بياعه (sold quantity)
  removed_qty NUMERIC(10,2) DEFAULT 0,    -- مشال (removed / damaged quantity)
  notes TEXT,                              -- Optional notes
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- One entry per product per branch per day
  UNIQUE(branch_id, product_id, tracking_date)
);

CREATE INDEX IF NOT EXISTS idx_dt_branch ON daily_tracking(branch_id);
CREATE INDEX IF NOT EXISTS idx_dt_date ON daily_tracking(tracking_date DESC);
CREATE INDEX IF NOT EXISTS idx_dt_product ON daily_tracking(product_id);
CREATE INDEX IF NOT EXISTS idx_dt_branch_date ON daily_tracking(branch_id, tracking_date);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS tr_dt_updated_at ON daily_tracking;
CREATE TRIGGER tr_dt_updated_at
BEFORE UPDATE ON daily_tracking
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- =====================
-- 4. ADD branch_id TO ORDERS
-- =====================
-- Link each order to a branch
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_area TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);


-- =====================
-- 5. ADD branch_id TO PRODUCTS (optional: per-branch inventory)
-- =====================
ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE out_of_stock_products ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);


-- =====================
-- 6. HELPER VIEWS
-- =====================

-- Daily tracking summary per branch per day
CREATE OR REPLACE VIEW daily_tracking_summary AS
SELECT
  dt.branch_id,
  b.name AS branch_name,
  dt.tracking_date,
  COUNT(DISTINCT dt.product_id) AS product_count,
  SUM(dt.sold_qty) AS total_sold,
  SUM(dt.removed_qty) AS total_removed,
  SUM(dt.sold_qty) + SUM(dt.removed_qty) AS total_movement
FROM daily_tracking dt
JOIN branches b ON b.id = dt.branch_id
GROUP BY dt.branch_id, b.name, dt.tracking_date
ORDER BY dt.tracking_date DESC;

-- Branch delivery areas with branch name
CREATE OR REPLACE VIEW delivery_areas_with_branch AS
SELECT
  bda.*,
  b.name AS branch_name,
  b.name_en AS branch_name_en
FROM branch_delivery_areas bda
JOIN branches b ON b.id = bda.branch_id
WHERE bda.is_active = TRUE AND b.is_active = TRUE
ORDER BY bda.delivery_fee ASC;


-- =====================
-- 7. ROW LEVEL SECURITY FOR NEW TABLES
-- =====================

-- Branches: everyone reads, admins manage
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active branches" ON branches;
CREATE POLICY "Anyone can view active branches"
  ON branches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage branches" ON branches;
CREATE POLICY "Admins can manage branches"
  ON branches FOR ALL USING (check_is_admin());

-- Branch Delivery Areas: everyone reads, admins manage
ALTER TABLE branch_delivery_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view delivery areas" ON branch_delivery_areas;
CREATE POLICY "Anyone can view delivery areas"
  ON branch_delivery_areas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage delivery areas" ON branch_delivery_areas;
CREATE POLICY "Admins can manage delivery areas"
  ON branch_delivery_areas FOR ALL USING (check_is_admin());

-- Daily Tracking: admins only
ALTER TABLE daily_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view daily tracking" ON daily_tracking;
CREATE POLICY "Admins can view daily tracking"
  ON daily_tracking FOR SELECT USING (check_is_admin());

DROP POLICY IF EXISTS "Admins can manage daily tracking" ON daily_tracking;
CREATE POLICY "Admins can manage daily tracking"
  ON daily_tracking FOR ALL USING (check_is_admin());


-- =====================
-- 8. SEED: DEFAULT BRANCH
-- =====================
INSERT INTO branches (name, name_en, address, phone, is_active, is_default)
VALUES ('الفرع الرئيسي', 'Main Branch', 'الشروق - المنطقة الأولى', '+20 123 456 7890', TRUE, TRUE)
ON CONFLICT DO NOTHING;


-- =====================
-- 9. SEED: DELIVERY AREAS FOR DEFAULT BRANCH
-- =====================
-- We seed all delivery areas linked to the first (default) branch.
-- Each branch can later customize their own areas via admin panel.

DO $$
DECLARE
  default_branch_id UUID;
BEGIN
  SELECT id INTO default_branch_id FROM branches WHERE is_default = TRUE LIMIT 1;
  
  IF default_branch_id IS NULL THEN
    RAISE NOTICE 'No default branch found. Skipping delivery area seed.';
    RETURN;
  END IF;

  -- Zone 25
  INSERT INTO branch_delivery_areas (branch_id, area_name, zone_label, delivery_fee) VALUES
    (default_branch_id, 'الحي الأول شرقي', 'Zone 25', 25),
    (default_branch_id, 'الحي الثاني شرقي', 'Zone 25', 25),
    (default_branch_id, 'الحي الثالث شرقي', 'Zone 25', 25),
    (default_branch_id, 'الحي الأول غربي', 'Zone 25', 25),
    (default_branch_id, 'الحي الثاني غربي', 'Zone 25', 25),
    (default_branch_id, 'الحي الثالث غربي', 'Zone 25', 25),
    (default_branch_id, 'الحي الرابع غربي', 'Zone 25', 25)
  ON CONFLICT (branch_id, area_name_normalized) DO NOTHING;

  -- Zone 30
  INSERT INTO branch_delivery_areas (branch_id, area_name, zone_label, delivery_fee) VALUES
    (default_branch_id, 'المنطقة الرابعة', 'Zone 30', 30),
    (default_branch_id, 'المنطقة الخامسة', 'Zone 30', 30),
    (default_branch_id, 'المنطقة السادسة', 'Zone 30', 30)
  ON CONFLICT (branch_id, area_name_normalized) DO NOTHING;

  -- Zone 35
  INSERT INTO branch_delivery_areas (branch_id, area_name, zone_label, delivery_fee) VALUES
    (default_branch_id, 'المنطقة السابعة', 'Zone 35', 35),
    (default_branch_id, 'المنطقة الثامنة', 'Zone 35', 35)
  ON CONFLICT (branch_id, area_name_normalized) DO NOTHING;

  -- Zone 40
  INSERT INTO branch_delivery_areas (branch_id, area_name, zone_label, delivery_fee) VALUES
    (default_branch_id, 'المنطقة التاسعة', 'Zone 40', 40),
    (default_branch_id, 'ألف مسكن', 'Zone 40', 40),
    (default_branch_id, 'الـ 70 متر', 'Zone 40', 40),
    (default_branch_id, 'الـ 100 متر', 'Zone 40', 40),
    (default_branch_id, 'الإسكان العائلي', 'Zone 40', 40)
  ON CONFLICT (branch_id, area_name_normalized) DO NOTHING;

  -- Additional Areas (25)
  INSERT INTO branch_delivery_areas (branch_id, area_name, zone_label, delivery_fee) VALUES
    (default_branch_id, 'جنة مصر', 'Additional', 25),
    (default_branch_id, 'دار مصر', 'Additional', 25),
    (default_branch_id, 'باتيو', 'Additional', 25),
    (default_branch_id, 'حسن علام', 'Additional', 25),
    (default_branch_id, 'هليوبوليس', 'Additional', 25)
  ON CONFLICT (branch_id, area_name_normalized) DO NOTHING;

  -- Additional Areas (30)
  INSERT INTO branch_delivery_areas (branch_id, area_name, zone_label, delivery_fee) VALUES
    (default_branch_id, 'باندورا إيست', 'Additional', 30),
    (default_branch_id, 'باندورا كندا', 'Additional', 30),
    (default_branch_id, 'العاصي فيو', 'Additional', 30),
    (default_branch_id, 'وصال', 'Additional', 30),
    (default_branch_id, 'المقصد الجديد', 'Additional', 30)
  ON CONFLICT (branch_id, area_name_normalized) DO NOTHING;

  -- Additional Areas (35)
  INSERT INTO branch_delivery_areas (branch_id, area_name, zone_label, delivery_fee) VALUES
    (default_branch_id, 'جراند الشروق', 'Additional', 35),
    (default_branch_id, 'فيزيا بلازا', 'Additional', 35),
    (default_branch_id, 'لاڤي هليوبوليس', 'Additional', 35)
  ON CONFLICT (branch_id, area_name_normalized) DO NOTHING;

  -- Additional Areas (40)
  INSERT INTO branch_delivery_areas (branch_id, area_name, zone_label, delivery_fee) VALUES
    (default_branch_id, 'البارون سيتي', 'Additional', 40),
    (default_branch_id, 'الشروق 2000', 'Additional', 40),
    (default_branch_id, 'بافور بالاس', 'Additional', 40),
    (default_branch_id, 'كليوباترا بلازا', 'Additional', 40),
    (default_branch_id, 'هضبة النخيل', 'Additional', 40),
    (default_branch_id, 'وادي النخيل', 'Additional', 40)
  ON CONFLICT (branch_id, area_name_normalized) DO NOTHING;

  RAISE NOTICE 'Seeded delivery areas for default branch: %', default_branch_id;
END $$;


-- ============================================================
-- DONE! Branch system, daily tracking & delivery areas ready.
-- Next: Update the admin panel and mobile app to use these tables.
-- ============================================================


-- =====================
-- 10. FIX: Stock auto-decrease on order (SECURITY DEFINER)
-- =====================
-- The original trigger runs under the calling user's RLS context.
-- When a guest/anon user places an order, the UPDATE on products fails
-- silently because RLS blocks it. Adding SECURITY DEFINER makes it
-- run as the owner (postgres) so the stock always gets reduced.
CREATE OR REPLACE FUNCTION auto_reduce_stock_after_order()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    UPDATE products 
    SET stock = GREATEST(0, stock - NEW.quantity) 
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger (function signature changed)
DROP TRIGGER IF EXISTS tr_reduce_stock ON order_items;
CREATE TRIGGER tr_reduce_stock
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION auto_reduce_stock_after_order();

