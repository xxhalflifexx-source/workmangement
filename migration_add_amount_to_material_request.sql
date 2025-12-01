-- Migration: Add amount field to MaterialRequest table
-- Run this in your Supabase SQL Editor or via Prisma migration

ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION;

-- Add comment
COMMENT ON COLUMN "MaterialRequest"."amount" IS 'Cost/amount for the material request - required before status update to APPROVED or FULFILLED';

