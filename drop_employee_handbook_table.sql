-- Migration: Drop EmployeeHandbook table
-- This migration removes the EmployeeHandbook table since it has been moved to Operations Common
-- Run this in your Supabase SQL Editor AFTER running migrate_employee_handbook_to_operations_common.sql

-- Drop the EmployeeHandbook table if it exists
DROP TABLE IF EXISTS "EmployeeHandbook";

-- Note: The Employee Handbook content is now stored as an SOPDocument in Operations Common
-- Access it via: /operations-common -> Employee Handbook folder

