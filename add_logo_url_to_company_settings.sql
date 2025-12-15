-- Add logoUrl column to CompanySettings table
ALTER TABLE "CompanySettings" 
ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;

