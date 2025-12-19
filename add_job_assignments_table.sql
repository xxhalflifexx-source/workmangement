-- Migration: Add JobAssignment table for multiple worker assignments
-- This allows a job to be assigned to multiple workers

CREATE TABLE IF NOT EXISTS "JobAssignment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "JobAssignment_jobId_idx" ON "JobAssignment"("jobId");
CREATE INDEX IF NOT EXISTS "JobAssignment_userId_idx" ON "JobAssignment"("userId");

-- Create unique constraint to prevent duplicate assignments
CREATE UNIQUE INDEX IF NOT EXISTS "JobAssignment_jobId_userId_key" ON "JobAssignment"("jobId", "userId");

-- Add foreign key constraints
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing assignments from Job.assignedTo to JobAssignment
-- This preserves existing single assignments
INSERT INTO "JobAssignment" ("id", "jobId", "userId", "createdAt")
SELECT 
    gen_random_uuid()::text,
    "id",
    "assignedTo",
    "createdAt"
FROM "Job"
WHERE "assignedTo" IS NOT NULL
ON CONFLICT ("jobId", "userId") DO NOTHING;

