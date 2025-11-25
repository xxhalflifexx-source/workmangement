-- AlterTable
ALTER TABLE "MaterialRequest" ADD COLUMN IF NOT EXISTS "requestNumber" TEXT,
ADD COLUMN IF NOT EXISTS "recommendedAction" TEXT;

-- CreateIndex (partial unique index - only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequest_requestNumber_key" 
ON "MaterialRequest"("requestNumber") 
WHERE "requestNumber" IS NOT NULL;

