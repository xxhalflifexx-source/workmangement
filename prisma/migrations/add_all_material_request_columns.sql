-- Add all missing columns to MaterialRequest table
-- This migration can be run directly on the database if Prisma migrate is not available
-- Run this script to add all required columns at once

-- Add requestNumber column (nullable, will be populated for new requests)
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "requestNumber" TEXT;

-- Add recommendedAction column (nullable)
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "recommendedAction" TEXT;

-- Add dateDelivered column (nullable)
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "dateDelivered" TIMESTAMP(3);

-- Add orderStatus column (nullable)
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "orderStatus" TEXT;

-- Create unique index on requestNumber (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequest_requestNumber_key" 
ON "MaterialRequest"("requestNumber") 
WHERE "requestNumber" IS NOT NULL;

