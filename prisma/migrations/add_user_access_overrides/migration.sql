-- CreateTable
CREATE TABLE "UserAccessOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "access" TEXT NOT NULL DEFAULT 'allowed',
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccessOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccessOverride_userId_componentName_key" ON "UserAccessOverride"("userId", "componentName");

-- CreateIndex
CREATE INDEX "UserAccessOverride_userId_idx" ON "UserAccessOverride"("userId");

-- CreateIndex
CREATE INDEX "UserAccessOverride_componentName_idx" ON "UserAccessOverride"("componentName");

-- AddForeignKey
ALTER TABLE "UserAccessOverride" ADD CONSTRAINT "UserAccessOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

