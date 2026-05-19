-- ============================================================
-- Add Branch Authentication Fields
-- Add username and password fields to branches table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add authentication fields to branches table
ALTER TABLE branches ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Update comments
COMMENT ON COLUMN branches.username IS 'Branch admin username for mobile app login';
COMMENT ON COLUMN branches.password_hash IS 'Hashed password for branch admin authentication';

-- Create a default admin user for testing (you should change this)
-- INSERT INTO branches (name, name_en, username, password_hash, is_active, is_default)
-- VALUES ('فرع تجريبي', 'Test Branch', 'admin', '$2b$10$example.hash.here', true, true)
-- ON CONFLICT (username) DO NOTHING;