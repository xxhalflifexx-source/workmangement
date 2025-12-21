-- OCR Learning Tables Migration
-- Run this SQL in the Supabase SQL Editor to create the OCR learning tables

-- OCR Extraction Successes table
CREATE TABLE IF NOT EXISTS "OCRExtractionSuccess" (
    "id" TEXT NOT NULL,
    "receiptText" TEXT NOT NULL,
    "extractedAmount" DOUBLE PRECISION NOT NULL,
    "storeName" TEXT,
    "strategy" TEXT NOT NULL,
    "linePattern" TEXT NOT NULL,
    "formatId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OCRExtractionSuccess_pkey" PRIMARY KEY ("id")
);

-- OCR Corrections table
CREATE TABLE IF NOT EXISTS "OCRCorrection" (
    "id" TEXT NOT NULL,
    "receiptText" TEXT NOT NULL,
    "originalAmount" DOUBLE PRECISION NOT NULL,
    "correctedAmount" DOUBLE PRECISION NOT NULL,
    "correctLinePattern" TEXT NOT NULL,
    "storeName" TEXT,
    "strategy" TEXT NOT NULL,
    "formatId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OCRCorrection_pkey" PRIMARY KEY ("id")
);

-- OCR Format Detection table
CREATE TABLE IF NOT EXISTS "OCRFormatDetection" (
    "id" TEXT NOT NULL,
    "detectedStoreName" TEXT NOT NULL,
    "correctStoreName" TEXT NOT NULL,
    "ocrTextSnippet" TEXT NOT NULL,
    "formatId" TEXT,
    "wasCorrect" BOOLEAN NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OCRFormatDetection_pkey" PRIMARY KEY ("id")
);

-- OCR Pattern Stats table (aggregated)
CREATE TABLE IF NOT EXISTS "OCRPatternStats" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "storeName" TEXT,
    "formatId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OCRPatternStats_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on pattern
ALTER TABLE "OCRPatternStats" ADD CONSTRAINT "OCRPatternStats_pattern_key" UNIQUE ("pattern");

-- Create indexes for OCRExtractionSuccess
CREATE INDEX IF NOT EXISTS "OCRExtractionSuccess_storeName_idx" ON "OCRExtractionSuccess"("storeName");
CREATE INDEX IF NOT EXISTS "OCRExtractionSuccess_formatId_idx" ON "OCRExtractionSuccess"("formatId");
CREATE INDEX IF NOT EXISTS "OCRExtractionSuccess_userId_idx" ON "OCRExtractionSuccess"("userId");

-- Create indexes for OCRCorrection
CREATE INDEX IF NOT EXISTS "OCRCorrection_storeName_idx" ON "OCRCorrection"("storeName");
CREATE INDEX IF NOT EXISTS "OCRCorrection_formatId_idx" ON "OCRCorrection"("formatId");
CREATE INDEX IF NOT EXISTS "OCRCorrection_userId_idx" ON "OCRCorrection"("userId");

-- Create indexes for OCRFormatDetection
CREATE INDEX IF NOT EXISTS "OCRFormatDetection_detectedStoreName_idx" ON "OCRFormatDetection"("detectedStoreName");
CREATE INDEX IF NOT EXISTS "OCRFormatDetection_correctStoreName_idx" ON "OCRFormatDetection"("correctStoreName");
CREATE INDEX IF NOT EXISTS "OCRFormatDetection_userId_idx" ON "OCRFormatDetection"("userId");

-- Create indexes for OCRPatternStats
CREATE INDEX IF NOT EXISTS "OCRPatternStats_storeName_idx" ON "OCRPatternStats"("storeName");
CREATE INDEX IF NOT EXISTS "OCRPatternStats_formatId_idx" ON "OCRPatternStats"("formatId");

-- Add foreign key constraints
ALTER TABLE "OCRExtractionSuccess" ADD CONSTRAINT "OCRExtractionSuccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OCRCorrection" ADD CONSTRAINT "OCRCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OCRFormatDetection" ADD CONSTRAINT "OCRFormatDetection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

