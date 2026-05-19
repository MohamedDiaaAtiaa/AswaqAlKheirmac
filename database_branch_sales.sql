-- ============================================================
-- Branch Sales Table (البيعة والمشال)
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS branch_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE, -- The date for this entry
  product_name TEXT NOT NULL,           -- الصنف
  quantity INTEGER DEFAULT 0,           -- الكميه
  price NUMERIC(10,2) DEFAULT 0,        -- السعر
  count INTEGER DEFAULT 0,              -- عدد
  sales_level NUMERIC(10,2) DEFAULT 0,  -- مستوى البيعة
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Unique constraint to prevent duplicate products per branch per day
  UNIQUE(branch_id, sale_date, product_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_branch_sales_branch_date ON branch_sales(branch_id, sale_date);

-- Auto-update timestamp
DROP TRIGGER IF EXISTS tr_branch_sales_updated_at ON branch_sales;
CREATE TRIGGER tr_branch_sales_updated_at
BEFORE UPDATE ON branch_sales
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE branch_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view branch_sales" ON branch_sales FOR SELECT USING (true);
CREATE POLICY "Anyone can insert branch_sales" ON branch_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update branch_sales" ON branch_sales FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete branch_sales" ON branch_sales FOR DELETE USING (true);
