-- Migration: Add remarks column to Invoice table
-- Run this SQL command directly on your Supabase database

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "remarks" TEXT;

-- Verify the column was added
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'Invoice' AND column_name = 'remarks';

