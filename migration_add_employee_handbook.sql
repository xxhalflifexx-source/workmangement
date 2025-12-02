-- Migration: Add EmployeeHandbook table
-- Run this in your Supabase SQL Editor or via Prisma migrate

CREATE TABLE IF NOT EXISTS "EmployeeHandbook" (
  "id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmployeeHandbook_pkey" PRIMARY KEY ("id")
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS "EmployeeHandbook_updatedAt_idx" ON "EmployeeHandbook"("updatedAt");

COMMENT ON TABLE "EmployeeHandbook" IS 'Stores the employee handbook content. Only admins can edit.';

