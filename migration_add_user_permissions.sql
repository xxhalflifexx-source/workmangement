-- Migration: Add permissions field to User table
-- This migration adds a JSON permissions field to store module access permissions

-- Add permissions column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" TEXT DEFAULT '{}';

-- Update existing users to have default permissions
-- Default permissions: timeClock=true, jobManagement=true, employeeHandbook=true, others=false
UPDATE "User" 
SET "permissions" = '{"timeClock":true,"jobManagement":true,"qualityControl":false,"hr":false,"finance":false,"inventory":false,"adminPanel":false,"employeeHandbook":true}'
WHERE "permissions" IS NULL OR "permissions" = '{}';

-- For ADMIN users, grant all permissions
UPDATE "User"
SET "permissions" = '{"timeClock":true,"jobManagement":true,"qualityControl":true,"hr":true,"finance":true,"inventory":true,"adminPanel":true,"employeeHandbook":true}'
WHERE "role" = 'ADMIN';

-- For MANAGER users, grant manager-level permissions
UPDATE "User"
SET "permissions" = '{"timeClock":true,"jobManagement":true,"qualityControl":true,"hr":true,"finance":true,"inventory":true,"adminPanel":false,"employeeHandbook":true}'
WHERE "role" = 'MANAGER';

