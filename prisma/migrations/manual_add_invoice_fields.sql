-- Manual migration for SQLite: Add invoice number and date fields
-- Run this SQL directly on your SQLite database

-- Add new columns to Invoice table
ALTER TABLE "Invoice" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "sentDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "releaseDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "collectionDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "creditDate" DATETIME;

-- Create unique index on invoiceNumber (if it doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

