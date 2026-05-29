-- =====================================================
-- MIGRATION: Instapay Payment Support
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- 1. Add new columns to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS transaction_screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_proof_type TEXT;

-- 2. Allow ANY authenticated user to upload receipts to the product-images bucket
--    (The existing policy only allows admins, which blocks customer receipt uploads)
CREATE POLICY "Authenticated users can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'receipts'
  );

-- 3. Also allow anonymous/guest users to upload receipts (for guest checkout)
CREATE POLICY "Anyone can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images' 
    AND (storage.foldername(name))[1] = 'receipts'
  );

-- =====================================================
-- DONE! Refresh your app and test the Instapay flow.
-- =====================================================
