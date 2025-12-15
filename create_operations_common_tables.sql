-- Create OperationsCommonFolder table
CREATE TABLE IF NOT EXISTS "OperationsCommonFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationsCommonFolder_pkey" PRIMARY KEY ("id")
);

-- Create OperationsCommonFile table
CREATE TABLE IF NOT EXISTS "OperationsCommonFile" (
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

    CONSTRAINT "OperationsCommonFile_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "OperationsCommonFolder_parentId_idx" ON "OperationsCommonFolder"("parentId");
CREATE INDEX IF NOT EXISTS "OperationsCommonFile_folderId_idx" ON "OperationsCommonFile"("folderId");

-- Add foreign key constraints
DO $$ 
BEGIN
    -- Add foreign key for OperationsCommonFolder.parentId
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'OperationsCommonFolder_parentId_fkey'
    ) THEN
        ALTER TABLE "OperationsCommonFolder" 
        ADD CONSTRAINT "OperationsCommonFolder_parentId_fkey" 
        FOREIGN KEY ("parentId") REFERENCES "OperationsCommonFolder"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for OperationsCommonFolder.createdBy
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'OperationsCommonFolder_createdBy_fkey'
    ) THEN
        ALTER TABLE "OperationsCommonFolder" 
        ADD CONSTRAINT "OperationsCommonFolder_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for OperationsCommonFile.folderId
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'OperationsCommonFile_folderId_fkey'
    ) THEN
        ALTER TABLE "OperationsCommonFile" 
        ADD CONSTRAINT "OperationsCommonFile_folderId_fkey" 
        FOREIGN KEY ("folderId") REFERENCES "OperationsCommonFolder"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for OperationsCommonFile.createdBy
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'OperationsCommonFile_createdBy_fkey'
    ) THEN
        ALTER TABLE "OperationsCommonFile" 
        ADD CONSTRAINT "OperationsCommonFile_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

