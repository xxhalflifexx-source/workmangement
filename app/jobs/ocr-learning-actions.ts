"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

// Types for learning data
interface ExtractionSuccessInput {
  receiptText: string;
  extractedAmount: number;
  storeName?: string;
  strategy: string;
  linePattern: string;
  formatId?: string;
}

interface CorrectionInput {
  receiptText: string;
  originalAmount: number;
  correctedAmount: number;
  correctLinePattern: string;
  storeName?: string;
  strategy: string;
  formatId?: string;
}

interface FormatDetectionInput {
  detectedStoreName: string;
  correctStoreName: string;
  ocrTextSnippet: string;
  formatId?: string;
  wasCorrect: boolean;
}

/**
 * Save successful extraction to database
 */
export async function saveExtractionSuccess(
  data: ExtractionSuccessInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { ok: false, error: "Not authenticated" };
    }

    await prisma.oCRExtractionSuccess.create({
      data: {
        receiptText: data.receiptText.substring(0, 500), // Limit to 500 chars
        extractedAmount: data.extractedAmount,
        storeName: data.storeName,
        strategy: data.strategy,
        linePattern: data.linePattern.substring(0, 500),
        formatId: data.formatId,
        userId: session.user.id,
      },
    });

    // Update pattern stats
    await updatePatternStats(data.linePattern, true, data.storeName, data.formatId);

    return { ok: true };
  } catch (error: any) {
    console.error("[OCR Learning] Failed to save extraction success:", error);
    return { ok: false, error: error?.message || "Failed to save" };
  }
}

/**
 * Save correction to database
 */
export async function saveCorrection(
  data: CorrectionInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { ok: false, error: "Not authenticated" };
    }

    await prisma.oCRCorrection.create({
      data: {
        receiptText: data.receiptText.substring(0, 500),
        originalAmount: data.originalAmount,
        correctedAmount: data.correctedAmount,
        correctLinePattern: data.correctLinePattern.substring(0, 500),
        storeName: data.storeName,
        strategy: data.strategy,
        formatId: data.formatId,
        userId: session.user.id,
      },
    });

    // Update pattern stats - the correct pattern succeeds, original fails
    await updatePatternStats(data.correctLinePattern, true, data.storeName, data.formatId);

    return { ok: true };
  } catch (error: any) {
    console.error("[OCR Learning] Failed to save correction:", error);
    return { ok: false, error: error?.message || "Failed to save" };
  }
}

/**
 * Save format detection result to database
 */
export async function saveFormatDetection(
  data: FormatDetectionInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { ok: false, error: "Not authenticated" };
    }

    await prisma.oCRFormatDetection.create({
      data: {
        detectedStoreName: data.detectedStoreName,
        correctStoreName: data.correctStoreName,
        ocrTextSnippet: data.ocrTextSnippet.substring(0, 500),
        formatId: data.formatId,
        wasCorrect: data.wasCorrect,
        userId: session.user.id,
      },
    });

    return { ok: true };
  } catch (error: any) {
    console.error("[OCR Learning] Failed to save format detection:", error);
    return { ok: false, error: error?.message || "Failed to save" };
  }
}

/**
 * Update pattern statistics
 */
async function updatePatternStats(
  linePattern: string,
  isSuccess: boolean,
  storeName?: string,
  formatId?: string
): Promise<void> {
  // Normalize pattern: replace amounts with placeholder
  const pattern = linePattern
    .replace(/\d+\.\d{2}/g, "AMOUNT")
    .replace(/\d+/g, "NUM")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .substring(0, 500);

  try {
    const existing = await prisma.oCRPatternStats.findUnique({
      where: { pattern },
    });

    if (existing) {
      await prisma.oCRPatternStats.update({
        where: { pattern },
        data: {
          successCount: isSuccess ? existing.successCount + 1 : existing.successCount,
          failureCount: isSuccess ? existing.failureCount : existing.failureCount + 1,
          storeName: storeName || existing.storeName,
          formatId: formatId || existing.formatId,
        },
      });
    } else {
      await prisma.oCRPatternStats.create({
        data: {
          pattern,
          successCount: isSuccess ? 1 : 0,
          failureCount: isSuccess ? 0 : 1,
          storeName,
          formatId,
        },
      });
    }
  } catch (error) {
    // Don't fail the main operation if stats update fails
    console.error("[OCR Learning] Failed to update pattern stats:", error);
  }
}

/**
 * Get global pattern statistics (aggregated from all users)
 */
export async function getGlobalPatternStats(): Promise<{
  ok: boolean;
  patterns?: Array<{
    pattern: string;
    successCount: number;
    failureCount: number;
    successRate: number;
    storeName?: string;
    formatId?: string;
  }>;
  error?: string;
}> {
  try {
    const patterns = await prisma.oCRPatternStats.findMany({
      orderBy: [
        { successCount: "desc" },
      ],
      take: 100, // Limit to top 100 patterns
    });

    return {
      ok: true,
      patterns: patterns.map((p) => ({
        pattern: p.pattern,
        successCount: p.successCount,
        failureCount: p.failureCount,
        successRate:
          p.successCount + p.failureCount > 0
            ? p.successCount / (p.successCount + p.failureCount)
            : 0.5,
        storeName: p.storeName || undefined,
        formatId: p.formatId || undefined,
      })),
    };
  } catch (error: any) {
    console.error("[OCR Learning] Failed to get global pattern stats:", error);
    return { ok: false, error: error?.message || "Failed to fetch patterns" };
  }
}

/**
 * Get global strategy success rates
 */
export async function getGlobalStrategyStats(): Promise<{
  ok: boolean;
  strategies?: Record<string, { success: number; failure: number; rate: number }>;
  error?: string;
}> {
  try {
    // Count successes by strategy
    const successesByStrategy = await prisma.oCRExtractionSuccess.groupBy({
      by: ["strategy"],
      _count: { id: true },
    });

    // Count corrections (failures) by strategy
    const correctionsByStrategy = await prisma.oCRCorrection.groupBy({
      by: ["strategy"],
      _count: { id: true },
    });

    const strategies: Record<string, { success: number; failure: number; rate: number }> = {};

    // Add successes
    for (const s of successesByStrategy) {
      strategies[s.strategy] = {
        success: s._count.id,
        failure: 0,
        rate: 1.0,
      };
    }

    // Add failures
    for (const c of correctionsByStrategy) {
      if (strategies[c.strategy]) {
        strategies[c.strategy].failure = c._count.id;
      } else {
        strategies[c.strategy] = {
          success: 0,
          failure: c._count.id,
          rate: 0,
        };
      }
    }

    // Calculate rates
    for (const key of Object.keys(strategies)) {
      const { success, failure } = strategies[key];
      const total = success + failure;
      strategies[key].rate = total > 0 ? success / total : 0.5;
    }

    return { ok: true, strategies };
  } catch (error: any) {
    console.error("[OCR Learning] Failed to get strategy stats:", error);
    return { ok: false, error: error?.message || "Failed to fetch strategies" };
  }
}

/**
 * Get format detection accuracy for a store
 */
export async function getFormatDetectionAccuracy(storeName: string): Promise<{
  ok: boolean;
  accuracy?: number;
  totalDetections?: number;
  error?: string;
}> {
  try {
    const detections = await prisma.oCRFormatDetection.findMany({
      where: {
        OR: [
          { detectedStoreName: storeName },
          { correctStoreName: storeName },
        ],
      },
      select: {
        wasCorrect: true,
      },
    });

    const total = detections.length;
    const correct = detections.filter((d) => d.wasCorrect).length;
    const accuracy = total > 0 ? correct / total : 0.5;

    return {
      ok: true,
      accuracy,
      totalDetections: total,
    };
  } catch (error: any) {
    console.error("[OCR Learning] Failed to get format detection accuracy:", error);
    return { ok: false, error: error?.message || "Failed to fetch accuracy" };
  }
}

/**
 * Batch sync local learning data to Supabase
 */
export async function syncLearningData(data: {
  extractions: ExtractionSuccessInput[];
  corrections: CorrectionInput[];
  formatDetections: FormatDetectionInput[];
}): Promise<{ ok: boolean; synced: number; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { ok: false, synced: 0, error: "Not authenticated" };
    }

    let synced = 0;

    // Batch insert extractions
    if (data.extractions.length > 0) {
      await prisma.oCRExtractionSuccess.createMany({
        data: data.extractions.map((e) => ({
          receiptText: e.receiptText.substring(0, 500),
          extractedAmount: e.extractedAmount,
          storeName: e.storeName,
          strategy: e.strategy,
          linePattern: e.linePattern.substring(0, 500),
          formatId: e.formatId,
          userId: session.user.id,
        })),
        skipDuplicates: true,
      });
      synced += data.extractions.length;
    }

    // Batch insert corrections
    if (data.corrections.length > 0) {
      await prisma.oCRCorrection.createMany({
        data: data.corrections.map((c) => ({
          receiptText: c.receiptText.substring(0, 500),
          originalAmount: c.originalAmount,
          correctedAmount: c.correctedAmount,
          correctLinePattern: c.correctLinePattern.substring(0, 500),
          storeName: c.storeName,
          strategy: c.strategy,
          formatId: c.formatId,
          userId: session.user.id,
        })),
        skipDuplicates: true,
      });
      synced += data.corrections.length;
    }

    // Batch insert format detections
    if (data.formatDetections.length > 0) {
      await prisma.oCRFormatDetection.createMany({
        data: data.formatDetections.map((f) => ({
          detectedStoreName: f.detectedStoreName,
          correctStoreName: f.correctStoreName,
          ocrTextSnippet: f.ocrTextSnippet.substring(0, 500),
          formatId: f.formatId,
          wasCorrect: f.wasCorrect,
          userId: session.user.id,
        })),
        skipDuplicates: true,
      });
      synced += data.formatDetections.length;
    }

    return { ok: true, synced };
  } catch (error: any) {
    console.error("[OCR Learning] Failed to sync learning data:", error);
    return { ok: false, synced: 0, error: error?.message || "Failed to sync" };
  }
}

