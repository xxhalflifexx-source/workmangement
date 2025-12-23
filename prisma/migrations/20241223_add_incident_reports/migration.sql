-- CreateTable
CREATE TABLE "IncidentReport" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentEmployee" (
    "id" TEXT NOT NULL,
    "incidentReportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'INVOLVED',

    CONSTRAINT "IncidentEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentReport_organizationId_idx" ON "IncidentReport"("organizationId");

-- CreateIndex
CREATE INDEX "IncidentReport_createdById_idx" ON "IncidentReport"("createdById");

-- CreateIndex
CREATE INDEX "IncidentReport_jobId_idx" ON "IncidentReport"("jobId");

-- CreateIndex
CREATE INDEX "IncidentReport_status_idx" ON "IncidentReport"("status");

-- CreateIndex
CREATE INDEX "IncidentReport_severity_idx" ON "IncidentReport"("severity");

-- CreateIndex
CREATE INDEX "IncidentEmployee_incidentReportId_idx" ON "IncidentEmployee"("incidentReportId");

-- CreateIndex
CREATE INDEX "IncidentEmployee_userId_idx" ON "IncidentEmployee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentEmployee_incidentReportId_userId_key" ON "IncidentEmployee"("incidentReportId", "userId");

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEmployee" ADD CONSTRAINT "IncidentEmployee_incidentReportId_fkey" FOREIGN KEY ("incidentReportId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEmployee" ADD CONSTRAINT "IncidentEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

