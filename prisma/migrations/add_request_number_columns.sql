-- Add requestNumber and recommendedAction columns to MaterialRequest table
-- This migration can be run directly on the database if Prisma migrate is not available

-- Add requestNumber column (nullable, will be populated for new requests)
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "requestNumber" TEXT;

-- Add recommendedAction column (nullable)
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "recommendedAction" TEXT;

-- Create unique index on requestNumber (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequest_requestNumber_key" 
ON "MaterialRequest"("requestNumber") 
WHERE "requestNumber" IS NOT NULL;

-- Optional: Backfill existing requests with request numbers if needed
-- Uncomment the following if you want to generate request numbers for existing records
/*
DO $$
DECLARE
    rec RECORD;
    seq_num INTEGER := 1;
BEGIN
    FOR rec IN 
        SELECT id FROM "MaterialRequest" 
        WHERE "requestNumber" IS NULL 
        ORDER BY "requestedDate" ASC
    LOOP
        UPDATE "MaterialRequest" 
        SET "requestNumber" = 'MR' || LPAD(seq_num::TEXT, 4, '0')
        WHERE id = rec.id;
        seq_num := seq_num + 1;
    END LOOP;
END $$;
*/

