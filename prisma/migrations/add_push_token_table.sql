-- Add PushToken table for mobile push notifications
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS "PushToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on token
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_token_key" UNIQUE ("token");

-- Create indexes
CREATE INDEX IF NOT EXISTS "PushToken_userId_idx" ON "PushToken"("userId");
CREATE INDEX IF NOT EXISTS "PushToken_platform_idx" ON "PushToken"("platform");

-- Add foreign key constraint
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

