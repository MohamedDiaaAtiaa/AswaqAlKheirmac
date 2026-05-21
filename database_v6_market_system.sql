-- ============================================================================
-- ASWAQ AL KHEIR — V6 MARKET MANAGEMENT SYSTEM UPGRADE
-- Run in Supabase SQL Editor
-- ============================================================================

-- 1. Branch Submissions Tracking
-- Tracks which branches have submitted their daily orders
CREATE TABLE IF NOT EXISTS branch_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_by TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'modified')),
  notes TEXT,
  UNIQUE(branch_id, submission_date)
);

-- 2. Workflow Configuration
-- Allows switching between different operational modes
CREATE TABLE IF NOT EXISTS workflow_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Insert default workflow config
INSERT INTO workflow_config (config_key, config_value) VALUES
  ('submission_mode', '{"mode": "branch_submit", "description": "Branches submit quantities, market edits details"}'),
  ('market_edit_fields', '{"fields": ["quantity", "count", "price", "meshal", "bayaawa"]}'),
  ('branch_edit_fields', '{"fields": ["quantity"]}')
ON CONFLICT (config_key) DO NOTHING;

-- 3. User Roles & Permissions
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE,
  role_name_ar TEXT,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO user_roles (role_name, role_name_ar, description, permissions, is_system) VALUES
  ('super_admin', 'مدير النظام', 'Full system access', '["*"]', TRUE),
  ('market_manager', 'مدير السوق', 'Market dashboard - edit all fields', '["view_market_dashboard", "edit_weights", "edit_prices", "edit_meshal", "manage_products", "manage_categories", "view_all_branches"]', TRUE),
  ('branch_manager', 'مدير فرع', 'Branch operations - submit orders', '["submit_branch_orders", "view_own_branch"]', TRUE),
  ('market_employee', 'موظف السوق', 'Market employee - enter data per branch', '["view_market_dashboard", "edit_weights", "edit_prices", "edit_meshal", "view_all_branches", "quick_branch_access"]', TRUE),
  ('branch_employee', 'موظف فرع', 'Branch employee - view only', '["view_own_branch"]', TRUE)
ON CONFLICT (role_name) DO NOTHING;

-- 4. Branch User Accounts (extends branches table)
-- Add role and permissions columns to branches
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'user_role') THEN
    ALTER TABLE branches ADD COLUMN user_role TEXT DEFAULT 'branch_manager';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'extra_permissions') THEN
    ALTER TABLE branches ADD COLUMN extra_permissions JSONB DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'temp_permissions') THEN
    ALTER TABLE branches ADD COLUMN temp_permissions JSONB DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'temp_permissions_expiry') THEN
    ALTER TABLE branches ADD COLUMN temp_permissions_expiry TIMESTAMPTZ;
  END IF;
END $$;

-- 5. Add image_url to categories support (stored in app_settings as JSON)
-- Categories are already in app_settings.value as JSON array
-- Each category object will now support: { id, label_ar, label_en, emoji, image_url }
-- No schema change needed - just app-level support

-- 6. Add product image support to branch_sales
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branch_sales' AND column_name = 'product_image_url') THEN
    ALTER TABLE branch_sales ADD COLUMN product_image_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branch_sales' AND column_name = 'category_id') THEN
    ALTER TABLE branch_sales ADD COLUMN category_id TEXT;
  END IF;
END $$;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_branch_submissions_date ON branch_submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_branch_submissions_branch ON branch_submissions(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_sales_date ON branch_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_branch_sales_branch_date ON branch_sales(branch_id, sale_date);

-- 8. Storage bucket for product/category images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY IF NOT EXISTS "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Allow authenticated uploads  
CREATE POLICY IF NOT EXISTS "Allow uploads to product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY IF NOT EXISTS "Allow updates to product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images');
