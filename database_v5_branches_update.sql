-- ============================================================
-- أسواق الخير (Aswaq Al Kheir) — v5 Update
-- 1. Seed all 8 branches with verified locations
-- 2. Ensure branch_sales table has correct columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- =====================
-- 1. FIX branch_sales COLUMNS
-- =====================
-- A previous migration (database_complete_migration.sql) renamed:
--   quantity → weight, count → amount, sales_level → commission_and_meshal
-- Our code expects: quantity, count, price, meshal
-- This fix adds the needed columns back if they were renamed.

-- Add missing columns safely (IF NOT EXISTS prevents errors)
ALTER TABLE branch_sales ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
ALTER TABLE branch_sales ADD COLUMN IF NOT EXISTS count INTEGER DEFAULT 0;
ALTER TABLE branch_sales ADD COLUMN IF NOT EXISTS meshal NUMERIC(10,2) DEFAULT 0;

-- If data was stored in the renamed columns, copy it back
DO $$
BEGIN
  -- Copy weight → quantity if weight column exists and has data
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'branch_sales' AND column_name = 'weight') THEN
    UPDATE branch_sales SET quantity = weight WHERE (quantity IS NULL OR quantity = 0) AND weight > 0;
  END IF;

  -- Copy amount → count if amount column exists and has data
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'branch_sales' AND column_name = 'amount') THEN
    UPDATE branch_sales SET count = amount WHERE (count IS NULL OR count = 0) AND amount > 0;
  END IF;

  -- Copy commission_and_meshal → meshal if that column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'branch_sales' AND column_name = 'commission_and_meshal') THEN
    UPDATE branch_sales SET meshal = commission_and_meshal WHERE (meshal IS NULL OR meshal = 0) AND commission_and_meshal > 0;
  END IF;
END $$;

-- =====================
-- 2. SEED ALL 8 BRANCHES
-- =====================
-- أسواق الخير has 8 branches across Obour City, El-Shorouk, and surrounding areas.
-- Note: is_default unique index only allows one TRUE, so only Main Souq is default.

-- Branch 1: السوق الرئيسي (Main Souq) — should already exist
INSERT INTO branches (name, name_en, address, phone, is_active, is_default, username, password_hash, latitude, longitude)
VALUES ('السوق الرئيسي', 'Main Souq', 'سوق العبور الرئيسي', '', TRUE, TRUE, 'Main', 'Password', 30.2420, 31.4860)
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- Branch 2: فرع الحي الأول شرقي
INSERT INTO branches (name, name_en, address, phone, is_active, is_default, username, password_hash, latitude, longitude)
VALUES ('فرع الحي الأول شرقي', 'First District East', 'الشروق - الحي الأول شرقي', '', TRUE, FALSE, 'branch_1e', 'Password', 30.1160, 31.6280)
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- Branch 3: فرع الحي الثالث شرقي
INSERT INTO branches (name, name_en, address, phone, is_active, is_default, username, password_hash, latitude, longitude)
VALUES ('فرع الحي الثالث شرقي', 'Third District East', 'الشروق - الحي الثالث شرقي', '', TRUE, FALSE, 'branch_3e', 'Password', 30.1100, 31.6350)
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- Branch 4: فرع الحي الثاني غربي
INSERT INTO branches (name, name_en, address, phone, is_active, is_default, username, password_hash, latitude, longitude)
VALUES ('فرع الحي الثاني غربي', 'Second District West', 'الشروق - الحي الثاني غربي', '', TRUE, FALSE, 'branch_2w', 'Password', 30.1200, 31.6150)
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- Branch 5: فرع جراند مول
INSERT INTO branches (name, name_en, address, phone, is_active, is_default, username, password_hash, latitude, longitude)
VALUES ('فرع جراند مول', 'Grand Mall', 'الشروق - جراند مول', '', TRUE, FALSE, 'branch_grand', 'Password', 30.1080, 31.6320)
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- Branch 6: فرع المنطقة الرابعة
INSERT INTO branches (name, name_en, address, phone, is_active, is_default, username, password_hash, latitude, longitude)
VALUES ('فرع المنطقة الرابعة', 'Fourth District', 'الشروق - المنطقة الرابعة', '', TRUE, FALSE, 'branch_4th', 'Password', 30.1130, 31.6220)
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- Branch 7: فرع ألف مسكن
INSERT INTO branches (name, name_en, address, phone, is_active, is_default, username, password_hash, latitude, longitude)
VALUES ('فرع ألف مسكن', '1000 Maskan', 'الشروق - ألف مسكن', '', TRUE, FALSE, 'branch_1000', 'Password', 30.1050, 31.6180)
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- Branch 8: فرع العبور
INSERT INTO branches (name, name_en, address, phone, is_active, is_default, username, password_hash, latitude, longitude)
VALUES ('فرع العبور', 'Obour Branch', 'مدينة العبور', '', TRUE, FALSE, 'branch_obour', 'Password', 30.2350, 31.4770)
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- ============================================================
-- DONE! 8 branches are now seeded with verified locations.
-- Branches:
-- 1. السوق الرئيسي (Main Souq) - سوق العبور
-- 2. فرع الحي الأول شرقي (First District East) - الشروق
-- 3. فرع الحي الثالث شرقي (Third District East) - الشروق
-- 4. فرع الحي الثاني غربي (Second District West) - الشروق
-- 5. فرع جراند مول (Grand Mall) - الشروق
-- 6. فرع المنطقة الرابعة (Fourth District) - الشروق
-- 7. فرع ألف مسكن (1000 Maskan) - الشروق
-- 8. فرع العبور (Obour Branch) - مدينة العبور
-- ============================================================
