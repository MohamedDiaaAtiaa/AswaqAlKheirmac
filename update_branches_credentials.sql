-- Run this query in the Supabase SQL Editor to update all existing branches

UPDATE branches 
SET 
  username = COALESCE(name_en, name), 
  password_hash = 'Password' 
WHERE username IS NULL OR username = '';
