-- Migration: Add SOPDocument and SOPTemplate tables
-- Run this in Supabase SQL Editor or via Prisma migrate
-- Date: 2025-01-21

-- Create SOPDocument table
CREATE TABLE IF NOT EXISTS "SOPDocument" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "folderId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SOPDocument_pkey" PRIMARY KEY ("id")
);

-- Create SOPTemplate table
CREATE TABLE IF NOT EXISTS "SOPTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "content" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SOPTemplate_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints for SOPDocument
-- Note: PostgreSQL doesn't support IF NOT EXISTS for constraints, so we check first
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SOPDocument_folderId_fkey'
  ) THEN
    ALTER TABLE "SOPDocument" 
      ADD CONSTRAINT "SOPDocument_folderId_fkey" 
      FOREIGN KEY ("folderId") REFERENCES "OperationsCommonFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SOPDocument_createdBy_fkey'
  ) THEN
    ALTER TABLE "SOPDocument" 
      ADD CONSTRAINT "SOPDocument_createdBy_fkey" 
      FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SOPTemplate_createdBy_fkey'
  ) THEN
    ALTER TABLE "SOPTemplate" 
      ADD CONSTRAINT "SOPTemplate_createdBy_fkey" 
      FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "SOPDocument_folderId_idx" ON "SOPDocument"("folderId");

