-- Supabase SQL Migration for MaterialRequest Table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- 
-- This adds the missing columns needed for Materials Requested functionality:
-- - dateDelivered: When items were delivered
-- - orderStatus: To Order, Ordered, Received
-- - requestNumber: Auto-generated request IDs (MR0001, MR0002, etc.)
-- - recommendedAction: Approve, Partial, Rejected

-- Step 1: Add the new columns
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "dateDelivered" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "orderStatus" TEXT,
ADD COLUMN IF NOT EXISTS "requestNumber" TEXT,
ADD COLUMN IF NOT EXISTS "recommendedAction" TEXT;

-- Step 2: Create unique index on requestNumber (allows nulls, but unique for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequest_requestNumber_key" 
ON "MaterialRequest"("requestNumber") 
WHERE "requestNumber" IS NOT NULL;

-- Step 3: Verify the columns were added (optional - run this to check)
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'MaterialRequest'
    AND column_name IN ('dateDelivered', 'orderStatus', 'requestNumber', 'recommendedAction')
ORDER BY column_name;

