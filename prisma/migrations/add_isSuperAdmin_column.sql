-- Migration: Add isSuperAdmin and organizationId columns for multi-tenant support
-- This migration adds support for multi-tenant super admin functionality
-- Run this migration to sync your database with the Prisma schema

-- ============================================
-- 0. Create Organization table if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "Organization_slug_idx" ON "Organization"("slug");
CREATE INDEX IF NOT EXISTS "Organization_isActive_idx" ON "Organization"("isActive");

-- ============================================
-- 1. Add isSuperAdmin column to User table
-- ============================================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS "User_isSuperAdmin_idx" ON "User"("isSuperAdmin");

-- ============================================
-- 2. Add organizationId columns to all tables
-- ============================================

-- User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- TimeEntry table
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Customer table
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Job table
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- InventoryItem table
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- MaterialRequest table
ALTER TABLE "MaterialRequest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- CompanySettings table
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
-- Add unique constraint on organizationId for CompanySettings (one settings per organization)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CompanySettings_organizationId_key'
    ) THEN
        ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_organizationId_key" UNIQUE ("organizationId");
    END IF;
END $$;

-- JobExpense table
ALTER TABLE "JobExpense" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Invoice table
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Quotation table
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Notification table
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- ManualFolder table
ALTER TABLE "ManualFolder" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- ManualFile table
ALTER TABLE "ManualFile" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- OperationsCommonFolder table
ALTER TABLE "OperationsCommonFolder" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- OperationsCommonFile table
ALTER TABLE "OperationsCommonFile" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- SOPDocument table
ALTER TABLE "SOPDocument" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- SOPTemplate table
ALTER TABLE "SOPTemplate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- ============================================
-- 3. Create indexes on organizationId columns
-- ============================================
CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX IF NOT EXISTS "TimeEntry_organizationId_idx" ON "TimeEntry"("organizationId");
CREATE INDEX IF NOT EXISTS "Customer_organizationId_idx" ON "Customer"("organizationId");
CREATE INDEX IF NOT EXISTS "Job_organizationId_idx" ON "Job"("organizationId");
CREATE INDEX IF NOT EXISTS "InventoryItem_organizationId_idx" ON "InventoryItem"("organizationId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_organizationId_idx" ON "MaterialRequest"("organizationId");
CREATE INDEX IF NOT EXISTS "CompanySettings_organizationId_idx" ON "CompanySettings"("organizationId");
CREATE INDEX IF NOT EXISTS "JobExpense_organizationId_idx" ON "JobExpense"("organizationId");
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_idx" ON "Invoice"("organizationId");
CREATE INDEX IF NOT EXISTS "Quotation_organizationId_idx" ON "Quotation"("organizationId");
CREATE INDEX IF NOT EXISTS "Notification_organizationId_idx" ON "Notification"("organizationId");
CREATE INDEX IF NOT EXISTS "ManualFolder_organizationId_idx" ON "ManualFolder"("organizationId");
CREATE INDEX IF NOT EXISTS "ManualFile_organizationId_idx" ON "ManualFile"("organizationId");
CREATE INDEX IF NOT EXISTS "OperationsCommonFolder_organizationId_idx" ON "OperationsCommonFolder"("organizationId");
CREATE INDEX IF NOT EXISTS "OperationsCommonFile_organizationId_idx" ON "OperationsCommonFile"("organizationId");
CREATE INDEX IF NOT EXISTS "SOPDocument_organizationId_idx" ON "SOPDocument"("organizationId");
CREATE INDEX IF NOT EXISTS "SOPTemplate_organizationId_idx" ON "SOPTemplate"("organizationId");

-- ============================================
-- 4. Add foreign key constraints (if Organization table exists)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Organization') THEN
        -- User table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'User_organizationId_fkey') THEN
            ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- TimeEntry table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'TimeEntry_organizationId_fkey') THEN
            ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- Customer table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Customer_organizationId_fkey') THEN
            ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- Job table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Job_organizationId_fkey') THEN
            ALTER TABLE "Job" ADD CONSTRAINT "Job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- InventoryItem table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InventoryItem_organizationId_fkey') THEN
            ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- MaterialRequest table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MaterialRequest_organizationId_fkey') THEN
            ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- CompanySettings table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CompanySettings_organizationId_fkey') THEN
            ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- JobExpense table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'JobExpense_organizationId_fkey') THEN
            ALTER TABLE "JobExpense" ADD CONSTRAINT "JobExpense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- Invoice table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Invoice_organizationId_fkey') THEN
            ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- Quotation table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Quotation_organizationId_fkey') THEN
            ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- Notification table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Notification_organizationId_fkey') THEN
            ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- ManualFolder table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ManualFolder_organizationId_fkey') THEN
            ALTER TABLE "ManualFolder" ADD CONSTRAINT "ManualFolder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- ManualFile table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ManualFile_organizationId_fkey') THEN
            ALTER TABLE "ManualFile" ADD CONSTRAINT "ManualFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- OperationsCommonFolder table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'OperationsCommonFolder_organizationId_fkey') THEN
            ALTER TABLE "OperationsCommonFolder" ADD CONSTRAINT "OperationsCommonFolder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- OperationsCommonFile table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'OperationsCommonFile_organizationId_fkey') THEN
            ALTER TABLE "OperationsCommonFile" ADD CONSTRAINT "OperationsCommonFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- SOPDocument table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SOPDocument_organizationId_fkey') THEN
            ALTER TABLE "SOPDocument" ADD CONSTRAINT "SOPDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
        
        -- SOPTemplate table
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SOPTemplate_organizationId_fkey') THEN
            ALTER TABLE "SOPTemplate" ADD CONSTRAINT "SOPTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- ============================================
-- 5. Set default values
-- ============================================
-- Update existing users to have isSuperAdmin = false by default
UPDATE "User" SET "isSuperAdmin" = false WHERE "isSuperAdmin" IS NULL;

-- ============================================
-- Migration Complete!
-- ============================================
-- After running this migration, regenerate Prisma Client:
-- npx prisma generate

