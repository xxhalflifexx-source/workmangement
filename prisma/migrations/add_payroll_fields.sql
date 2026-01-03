-- Add payroll fields to CompanySettings
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "payPeriodType" TEXT DEFAULT 'weekly';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "payDay" TEXT DEFAULT 'friday';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "payPeriodStartDate" TIMESTAMP(3);
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "overtimeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "overtimeType" TEXT DEFAULT 'weekly40';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "overtimeRate" DOUBLE PRECISION DEFAULT 1.5;

