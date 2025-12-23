-- Migration: Add Job Numbering System
-- This adds sequential job numbers with format PREFIX+YEAR-NUMBER (e.g., TCB2025-0001)

-- Step 1: Add job numbering fields to Organization table
ALTER TABLE "Organization" 
ADD COLUMN IF NOT EXISTS "jobNumberPrefix" TEXT DEFAULT 'JOB',
ADD COLUMN IF NOT EXISTS "jobNumberCounter" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "jobNumberYear" INTEGER;

-- Step 2: Add jobNumber field to Job table
ALTER TABLE "Job" 
ADD COLUMN IF NOT EXISTS "jobNumber" TEXT;

-- Step 3: Create unique index on jobNumber
CREATE UNIQUE INDEX IF NOT EXISTS "Job_jobNumber_key" ON "Job"("jobNumber");

-- Step 4: Update TCB Metal Works organization with TCB prefix
UPDATE "Organization" 
SET "jobNumberPrefix" = 'TCB'
WHERE name = 'TCB Metal Works' OR slug = 'tcb-metal-works';

-- Step 5: Backfill existing jobs with job numbers
-- First, assign TCB2025-0001 to the FIRST job created today (2025)
WITH today_job AS (
  SELECT j.id
  FROM "Job" j
  WHERE j."jobNumber" IS NULL
    AND DATE(j."createdAt") = CURRENT_DATE
    AND EXTRACT(YEAR FROM j."createdAt") = EXTRACT(YEAR FROM CURRENT_DATE)
  ORDER BY j."createdAt" ASC
  LIMIT 1
)
UPDATE "Job" j
SET "jobNumber" = CONCAT(
  COALESCE(o."jobNumberPrefix", 'JOB'),
  EXTRACT(YEAR FROM CURRENT_DATE)::TEXT,
  '-0001'
)
FROM "Organization" o, today_job tj
WHERE j.id = tj.id
  AND j."organizationId" = o.id;

-- Then assign job numbers to all remaining jobs based on creation order
-- For jobs created today: exclude the one that got 0001, then number remaining as 0002, 0003, etc.
-- For jobs from other dates: number sequentially from 0001
WITH ranked_jobs AS (
  SELECT 
    j.id,
    j."organizationId",
    o."jobNumberPrefix",
    EXTRACT(YEAR FROM j."createdAt")::INTEGER as job_year,
    CASE 
      -- Jobs created today: exclude first one (already has 0001), number rest starting from 2
      WHEN DATE(j."createdAt") = CURRENT_DATE THEN 
        ROW_NUMBER() OVER (
          PARTITION BY j."organizationId", DATE(j."createdAt")
          ORDER BY j."createdAt"
        ) + 1  -- +1 because first job already got 0001
      -- Jobs from other dates: sequential from 0001
      ELSE
        ROW_NUMBER() OVER (
          PARTITION BY j."organizationId", EXTRACT(YEAR FROM j."createdAt")
          ORDER BY j."createdAt"
        )
    END as row_num
  FROM "Job" j
  LEFT JOIN "Organization" o ON j."organizationId" = o.id
  WHERE j."jobNumber" IS NULL
)
UPDATE "Job" j
SET "jobNumber" = CONCAT(
  COALESCE(rj."jobNumberPrefix", 'JOB'),
  rj.job_year::TEXT,
  '-',
  LPAD(rj.row_num::TEXT, 4, '0')
)
FROM ranked_jobs rj
WHERE j.id = rj.id;

-- Step 6: Update organization counters based on existing jobs
WITH job_counts AS (
  SELECT 
    "organizationId",
    EXTRACT(YEAR FROM MAX("createdAt"))::INTEGER as latest_year,
    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM "createdAt") = EXTRACT(YEAR FROM CURRENT_DATE)) as current_year_count
  FROM "Job"
  WHERE "organizationId" IS NOT NULL
  GROUP BY "organizationId"
)
UPDATE "Organization" o
SET 
  "jobNumberYear" = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  "jobNumberCounter" = COALESCE(jc.current_year_count, 0)
FROM job_counts jc
WHERE o.id = jc."organizationId";

-- For organizations without jobs, set defaults
UPDATE "Organization"
SET 
  "jobNumberYear" = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  "jobNumberCounter" = 0
WHERE "jobNumberYear" IS NULL;

-- Verify the migration
SELECT 
  'Organizations' as table_name,
  COUNT(*) as total,
  COUNT("jobNumberPrefix") as with_prefix
FROM "Organization"
UNION ALL
SELECT 
  'Jobs' as table_name,
  COUNT(*) as total,
  COUNT("jobNumber") as with_job_number
FROM "Job";

