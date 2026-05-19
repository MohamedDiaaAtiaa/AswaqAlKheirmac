-- ============================================================
-- أسواق الخير (Aswaq Al Kheir) — Database Migration v4
-- Adds branch coordinates & store info settings
-- Run this AFTER the branch system schema (database_v3_branch_system.sql)
-- ============================================================

-- =====================
-- 1. BRANCH COORDINATES (for nearest-branch detection)
-- =====================
ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);

-- Index for spatial queries (simple distance calc)
CREATE INDEX IF NOT EXISTS idx_branches_coords ON branches (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- =====================
-- 2. STORE INFO SETTINGS (editable from admin panel)
-- =====================
INSERT INTO app_settings (key, value) VALUES (
  'store_info',
  '{
    "name_ar": "أسواق الخير",
    "name_en": "Aswaq Al Kheir",
    "phone": "",
    "whatsapp": "",
    "logo_url": "",
    "hero_image_url": "",
    "facebook_url": "https://www.facebook.com/AswaqALkhayrObourCity",
    "instagram_url": "",
    "tiktok_url": "",
    "description_ar": "مع أسواق الخير أنت دايماً بخير",
    "description_en": "With Aswaq Al Kheir, you are always in good hands",
    "slogan_ar": "مع أسواق الخير أنت دايماً بخير",
    "slogan_en": "Fresh quality, always."
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- DONE! Branch coordinates and store info settings are ready.
-- ============================================================
