-- Migration: Add ManualFolder and ManualFile tables
-- Run this SQL directly in Supabase SQL Editor

-- Create ManualFolder table
CREATE TABLE IF NOT EXISTS "ManualFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualFolder_pkey" PRIMARY KEY ("id")
);

-- Create ManualFile table
CREATE TABLE IF NOT EXISTS "ManualFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "folderId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualFile_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "ManualFolder_parentId_idx" ON "ManualFolder"("parentId");
CREATE INDEX IF NOT EXISTS "ManualFile_folderId_idx" ON "ManualFile"("folderId");

-- Add foreign key constraints
DO $$ 
BEGIN
    -- Add foreign key for ManualFolder.parentId (self-reference)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ManualFolder_parentId_fkey'
    ) THEN
        ALTER TABLE "ManualFolder" 
        ADD CONSTRAINT "ManualFolder_parentId_fkey" 
        FOREIGN KEY ("parentId") REFERENCES "ManualFolder"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for ManualFolder.createdBy
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ManualFolder_createdBy_fkey'
    ) THEN
        ALTER TABLE "ManualFolder" 
        ADD CONSTRAINT "ManualFolder_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for ManualFile.folderId
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ManualFile_folderId_fkey'
    ) THEN
        ALTER TABLE "ManualFile" 
        ADD CONSTRAINT "ManualFile_folderId_fkey" 
        FOREIGN KEY ("folderId") REFERENCES "ManualFolder"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for ManualFile.createdBy
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ManualFile_createdBy_fkey'
    ) THEN
        ALTER TABLE "ManualFile" 
        ADD CONSTRAINT "ManualFile_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

