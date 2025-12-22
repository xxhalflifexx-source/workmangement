-- Migration: Move Employee Handbook to Operations Common
-- This migration moves any existing EmployeeHandbook content to an SOPDocument in Operations Common
-- Run this in your Supabase SQL Editor

-- Step 1: Create an "Employee Handbook" folder in Operations Common (if it doesn't exist)
-- We'll need to get a user ID for createdBy - using the first admin user
DO $$
DECLARE
  admin_user_id TEXT;
  handbook_folder_id TEXT;
  handbook_exists BOOLEAN;
BEGIN
  -- Get first admin user
  SELECT id INTO admin_user_id FROM "User" WHERE role = 'ADMIN' LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE NOTICE 'No admin user found. Skipping Employee Handbook folder creation.';
  ELSE
    -- Check if "Employee Handbook" folder already exists
    SELECT EXISTS(
      SELECT 1 FROM "OperationsCommonFolder" 
      WHERE name = 'Employee Handbook' AND "parentId" IS NULL
    ) INTO handbook_exists;
    
    IF NOT handbook_exists THEN
      -- Create the folder
      INSERT INTO "OperationsCommonFolder" (id, name, "parentId", "createdBy", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::TEXT,
        'Employee Handbook',
        NULL,
        admin_user_id,
        NOW(),
        NOW()
      )
      RETURNING id INTO handbook_folder_id;
      
      RAISE NOTICE 'Created Employee Handbook folder with ID: %', handbook_folder_id;
    ELSE
      -- Get existing folder ID
      SELECT id INTO handbook_folder_id FROM "OperationsCommonFolder" 
      WHERE name = 'Employee Handbook' AND "parentId" IS NULL
      LIMIT 1;
      
      RAISE NOTICE 'Employee Handbook folder already exists with ID: %', handbook_folder_id;
    END IF;
    
    -- Step 2: Migrate EmployeeHandbook content to SOPDocument (if table exists and has data)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'EmployeeHandbook') THEN
      -- Check if there's existing handbook data
      IF EXISTS (SELECT 1 FROM "EmployeeHandbook" LIMIT 1) THEN
        -- Check if Employee Handbook SOP already exists
        IF NOT EXISTS (
          SELECT 1 FROM "SOPDocument" 
          WHERE title = 'Employee Handbook' AND "folderId" = handbook_folder_id
        ) THEN
          -- Migrate the content
          INSERT INTO "SOPDocument" (id, title, content, "folderId", "createdBy", "createdAt", "updatedAt")
          SELECT 
            gen_random_uuid()::TEXT,
            'Employee Handbook',
            content,
            handbook_folder_id,
            COALESCE("updatedBy", admin_user_id),
            COALESCE("createdAt", NOW()),
            COALESCE("updatedAt", NOW())
          FROM "EmployeeHandbook"
          ORDER BY "updatedAt" DESC
          LIMIT 1;
          
          RAISE NOTICE 'Migrated Employee Handbook content to SOPDocument';
        ELSE
          RAISE NOTICE 'Employee Handbook SOP Document already exists. Skipping migration.';
        END IF;
      ELSE
        RAISE NOTICE 'EmployeeHandbook table exists but is empty. No content to migrate.';
      END IF;
    ELSE
      RAISE NOTICE 'EmployeeHandbook table does not exist. No content to migrate.';
    END IF;
  END IF;
END $$;

-- Step 3: Drop the EmployeeHandbook table if it exists (optional - uncomment if you want to remove it)
-- DROP TABLE IF EXISTS "EmployeeHandbook";

