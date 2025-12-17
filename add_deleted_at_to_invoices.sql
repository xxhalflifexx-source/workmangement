-- Add deletedAt column to Invoice table for soft delete
-- This prevents invoice numbers from being reused even after deletion

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Create index for faster queries filtering out deleted invoices
CREATE INDEX IF NOT EXISTS "Invoice_deletedAt_idx" ON "Invoice"("deletedAt");

