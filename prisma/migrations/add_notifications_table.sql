-- Migration: Add Notification table
-- Run this in Supabase SQL Editor or via Prisma migrate

-- Create Notification table
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "type" TEXT NOT NULL DEFAULT 'INFO',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "linkUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

