-- AlterTable
ALTER TABLE "MaterialRequest" ADD COLUMN IF NOT EXISTS "dateDelivered" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "orderStatus" TEXT;

