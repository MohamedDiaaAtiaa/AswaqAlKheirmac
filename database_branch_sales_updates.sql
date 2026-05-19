-- ============================================================
-- Branch Sales Table Updates
-- Add meshal field and rename sales_level to commission
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add meshal column
ALTER TABLE branch_sales ADD COLUMN IF NOT EXISTS meshal NUMERIC(10,2) DEFAULT 0;

-- Rename sales_level to commission (if not already done)
-- Note: In PostgreSQL, renaming columns requires checking if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'branch_sales' AND column_name = 'sales_level') THEN
        ALTER TABLE branch_sales RENAME COLUMN sales_level TO commission;
    END IF;
END $$;

-- Update the comment
COMMENT ON COLUMN branch_sales.commission IS 'العمولة (Commission)';
COMMENT ON COLUMN branch_sales.meshal IS 'المشال (Meshal)';