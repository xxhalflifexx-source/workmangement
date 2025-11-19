-- Add invoice number and additional date fields to Invoice table
ALTER TABLE "Invoice" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "sentDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "releaseDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "collectionDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "creditDate" DATETIME;

-- Create unique index on invoiceNumber
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

