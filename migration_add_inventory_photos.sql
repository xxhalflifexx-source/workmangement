-- Migration: Add photos field to InventoryItem table
-- This migration adds support for multiple photos per inventory item
-- Run this in your Supabase SQL Editor

-- Add photos column to InventoryItem table
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "photos" TEXT;

-- Update description to be TEXT type for longer descriptions
ALTER TABLE "InventoryItem" ALTER COLUMN "description" TYPE TEXT;

-- Add comment explaining the photos field
COMMENT ON COLUMN "InventoryItem"."photos" IS 'JSON array of image URLs. Supports multiple photos showing: what the item is, current condition, identifying marks or variations.';

COMMENT ON COLUMN "InventoryItem"."description" IS 'Clear text description of the item, its purpose, and key characteristics.';

