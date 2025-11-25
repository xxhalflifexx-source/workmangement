ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "dateDelivered" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "orderStatus" TEXT,
ADD COLUMN IF NOT EXISTS "requestNumber" TEXT,
ADD COLUMN IF NOT EXISTS "recommendedAction" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequest_requestNumber_key" 
ON "MaterialRequest"("requestNumber") 
WHERE "requestNumber" IS NOT NULL;