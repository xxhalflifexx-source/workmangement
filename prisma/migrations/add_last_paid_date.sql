-- Add lastPaidDate field to User table for payroll tracking
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastPaidDate" TIMESTAMP(3);

