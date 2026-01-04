-- Add forgot-to-clock-out correction fields to TimeEntry
-- These fields support the "Forgot to clock out?" feature that allows employees
-- to correct their clock-out time while preserving a frozen snapshot of the wrong hours

-- Add new fields for tracking corrections
ALTER TABLE "TimeEntry" ADD COLUMN "wrongRecordedNetSeconds" INTEGER;
ALTER TABLE "TimeEntry" ADD COLUMN "correctionNote" TEXT;
ALTER TABLE "TimeEntry" ADD COLUMN "correctionAppliedAt" TIMESTAMP(3);

-- Update flagStatus constraint to include FORGOT_CLOCK_OUT
-- First drop the existing constraint if it exists
ALTER TABLE "TimeEntry" DROP CONSTRAINT IF EXISTS "TimeEntry_flagStatus_check";

-- Add new constraint with FORGOT_CLOCK_OUT value
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_flagStatus_check" 
  CHECK ("flagStatus" IN ('NONE', 'OVER_CAP', 'EDIT_REQUEST_PENDING', 'RESOLVED', 'FORGOT_CLOCK_OUT'));

-- Add comment explaining the fields
COMMENT ON COLUMN "TimeEntry"."wrongRecordedNetSeconds" IS 'FROZEN snapshot of net work seconds at correction submission time. Never recompute - this is evidence of what system believed before fix.';
COMMENT ON COLUMN "TimeEntry"."correctionNote" IS 'Optional note from employee when submitting forgot-to-clock-out correction';
COMMENT ON COLUMN "TimeEntry"."correctionAppliedAt" IS 'Timestamp when forgot-to-clock-out correction was applied';

