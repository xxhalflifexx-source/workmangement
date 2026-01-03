-- Add soft cap fields to TimeEntry for tracking net work time and flagging entries over 16 hours

-- Create enum type for time entry state (represented as text in PostgreSQL via Prisma)
-- Note: Prisma uses string enums stored as TEXT, we'll use CHECK constraints for validation

-- Add new columns
ALTER TABLE "TimeEntry" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'WORKING';
ALTER TABLE "TimeEntry" ADD COLUMN "workAccumSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TimeEntry" ADD COLUMN "lastStateChangeAt" TIMESTAMP(3);
ALTER TABLE "TimeEntry" ADD COLUMN "capMinutes" INTEGER NOT NULL DEFAULT 960;
ALTER TABLE "TimeEntry" ADD COLUMN "flagStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "TimeEntry" ADD COLUMN "overCapAt" TIMESTAMP(3);

-- Add check constraints for valid enum values
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_state_check" 
  CHECK ("state" IN ('WORKING', 'ON_BREAK', 'CLOCKED_OUT'));

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_flagStatus_check" 
  CHECK ("flagStatus" IN ('NONE', 'OVER_CAP', 'EDIT_REQUEST_PENDING', 'RESOLVED'));

-- Create index for efficient querying of open entries that need cap evaluation
CREATE INDEX "TimeEntry_state_flagStatus_idx" ON "TimeEntry"("state", "flagStatus");
CREATE INDEX "TimeEntry_lastStateChangeAt_idx" ON "TimeEntry"("lastStateChangeAt");

-- Backfill existing open entries (clockOut is null)
-- Set state based on current break status
UPDATE "TimeEntry" 
SET 
  "state" = CASE 
    WHEN "clockOut" IS NOT NULL THEN 'CLOCKED_OUT'
    WHEN "breakStart" IS NOT NULL AND "breakEnd" IS NULL THEN 'ON_BREAK'
    ELSE 'WORKING'
  END,
  "lastStateChangeAt" = CASE
    WHEN "clockOut" IS NOT NULL THEN "clockOut"
    WHEN "breakStart" IS NOT NULL AND "breakEnd" IS NULL THEN "breakStart"
    WHEN "breakEnd" IS NOT NULL THEN "breakEnd"
    ELSE "clockIn"
  END,
  "workAccumSeconds" = CASE
    WHEN "clockOut" IS NOT NULL THEN 
      -- For completed entries, calculate total work time excluding breaks
      EXTRACT(EPOCH FROM (COALESCE("clockOut", NOW()) - "clockIn"))::INTEGER
      - COALESCE(EXTRACT(EPOCH FROM ("breakEnd" - "breakStart"))::INTEGER, 0)
    WHEN "breakStart" IS NOT NULL THEN
      -- For entries on break or with completed break, calculate work up to break start
      EXTRACT(EPOCH FROM ("breakStart" - "clockIn"))::INTEGER
      + CASE 
          WHEN "breakEnd" IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (NOW() - "breakEnd"))::INTEGER
          ELSE 0
        END
    ELSE 0 -- For active WORKING entries, we start fresh (0 accumulator + elapsed since clockIn)
  END,
  "capMinutes" = 960,
  "flagStatus" = 'NONE';

