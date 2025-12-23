-- Migration: Add Incident Reports Tables
-- Run this SQL in Supabase SQL Editor to create the incident reports tables

-- CreateTable: IncidentReport
CREATE TABLE IF NOT EXISTS "IncidentReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "injuryDetails" TEXT,
    "witnesses" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "photos" TEXT[],
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IncidentEmployee (junction table for employees involved)
CREATE TABLE IF NOT EXISTS "IncidentEmployee" (
    "id" TEXT NOT NULL,
    "incidentReportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'INVOLVED',

    CONSTRAINT "IncidentEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: IncidentReport indexes
CREATE INDEX IF NOT EXISTS "IncidentReport_organizationId_idx" ON "IncidentReport"("organizationId");
CREATE INDEX IF NOT EXISTS "IncidentReport_createdById_idx" ON "IncidentReport"("createdById");
CREATE INDEX IF NOT EXISTS "IncidentReport_jobId_idx" ON "IncidentReport"("jobId");
CREATE INDEX IF NOT EXISTS "IncidentReport_status_idx" ON "IncidentReport"("status");
CREATE INDEX IF NOT EXISTS "IncidentReport_severity_idx" ON "IncidentReport"("severity");

-- CreateIndex: IncidentEmployee indexes
CREATE INDEX IF NOT EXISTS "IncidentEmployee_incidentReportId_idx" ON "IncidentEmployee"("incidentReportId");
CREATE INDEX IF NOT EXISTS "IncidentEmployee_userId_idx" ON "IncidentEmployee"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "IncidentEmployee_incidentReportId_userId_key" ON "IncidentEmployee"("incidentReportId", "userId");

-- AddForeignKey: IncidentReport -> Organization
ALTER TABLE "IncidentReport" 
ADD CONSTRAINT "IncidentReport_organizationId_fkey" 
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: IncidentReport -> User (createdBy)
ALTER TABLE "IncidentReport" 
ADD CONSTRAINT "IncidentReport_createdById_fkey" 
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: IncidentReport -> Job
ALTER TABLE "IncidentReport" 
ADD CONSTRAINT "IncidentReport_jobId_fkey" 
FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: IncidentEmployee -> IncidentReport
ALTER TABLE "IncidentEmployee" 
ADD CONSTRAINT "IncidentEmployee_incidentReportId_fkey" 
FOREIGN KEY ("incidentReportId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: IncidentEmployee -> User
ALTER TABLE "IncidentEmployee" 
ADD CONSTRAINT "IncidentEmployee_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Done! You should now be able to use the Incident Reports feature.

