-- Add orderStatus and dateDelivered columns to MaterialRequest table
-- This migration can be run directly on the database if Prisma migrate is not available

-- Add dateDelivered column (nullable)
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "dateDelivered" TIMESTAMP(3);

-- Add orderStatus column (nullable)
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "orderStatus" TEXT;

