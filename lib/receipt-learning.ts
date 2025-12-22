/**
 * Learning system for OCR receipt extraction
 * Tracks successful extractions and user corrections to improve accuracy over time
 */

import { ReceiptFormat } from "./receipt-formats";

const STORAGE_KEY = "receipt_ocr_learning_data";
const MAX_STORED_ITEMS = 1000; // Limit storage size

export interface SuccessfulExtraction {
  receiptText: string;
  extractedAmount: number;
  storeName?: string;
  strategy: string;
  linePattern: string; // The line that contained the total
  timestamp: number;
  formatId?: string;
}

export interface Correction {
  receiptText: string;
  originalAmount: number;
  correctedAmount: number;
  correctLinePattern: string;
  storeName?: string;
  timestamp: number;
  strategy: string;
  formatId?: string;
}

export interface LearnedPattern {
  pattern: string; // Regex pattern or line structure
  successCount: number;
  failureCount: number;
  successRate: number;
  lastUsed: number;
  storeName?: string;
  formatId?: string;
}

export interface FormatDetection {
  detectedStoreName: string;
  correctStoreName: string;
  ocrText: string;
  formatId?: string;
  timestamp: number;
  wasCorrect: boolean;
}

export interface LearningData {
  successfulExtractions: SuccessfulExtraction[];
  corrections: Correction[];
  formatDetections: FormatDetection[];
  patternSuccess: Record<string, number>; // Pattern -> success count
  strategySuccess: Record<string, number>; // Strategy -> success count
  patternFailures: Record<string, number>; // Pattern -> failure count
  strategyFailures: Record<string, number>; // Strategy -> failure count
  formatDetectionSuccess: Record<string, number>; // Store name -> success count
  formatDetectionFailures: Record<string, number>; // Store name -> failure count
}

/**
 * Get learning data from localStorage
 */
function getLearningData(): LearningData {
  if (typeof window === "undefined") {
    return {
      successfulExtractions: [],
      corrections: [],
      formatDetections: [],
      patternSuccess: {},
      strategySuccess: {},
      patternFailures: {},
      strategyFailures: {},
      formatDetectionSuccess: {},
      formatDetectionFailures: {},
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Ensure all required properties exist (for backward compatibility)
      return {
        successfulExtractions: data.successfulExtractions || [],
        corrections: data.corrections || [],
        formatDetections: data.formatDetections || [],
        patternSuccess: data.patternSuccess || {},
        strategySuccess: data.strategySuccess || {},
        patternFailures: data.patternFailures || {},
        strategyFailures: data.strategyFailures || {},
        formatDetectionSuccess: data.formatDetectionSuccess || {},
        formatDetectionFailures: data.formatDetectionFailures || {},
      };
    }
  } catch (err) {
    console.error("[ReceiptLearning] Failed to load learning data:", err);
  }

  return {
    successfulExtractions: [],
    corrections: [],
    formatDetections: [],
    patternSuccess: {},
    strategySuccess: {},
    patternFailures: {},
    strategyFailures: {},
    formatDetectionSuccess: {},
    formatDetectionFailures: {},
  };
}

/**
 * Save learning data to localStorage
 */
function saveLearningData(data: LearningData): void {
  if (typeof window === "undefined") return;

  // Limit storage size by keeping only recent items
  const maxItems = MAX_STORED_ITEMS;
  
  try {
    if (data.successfulExtractions.length > maxItems) {
      data.successfulExtractions = data.successfulExtractions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, maxItems);
    }
    if (data.corrections.length > maxItems) {
      data.corrections = data.corrections
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, maxItems);
    }
    if (data.formatDetections && data.formatDetections.length > maxItems) {
      data.formatDetections = data.formatDetections
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, maxItems);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("[ReceiptLearning] Failed to save learning data:", err);
    // If storage is full, try to clear old data
    try {
      const cleared = {
        ...data,
        successfulExtractions: data.successfulExtractions.slice(-maxItems / 2),
        corrections: data.corrections.slice(-maxItems / 2),
        formatDetections: (data.formatDetections || []).slice(-maxItems / 2),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
    } catch (clearErr) {
      console.error("[ReceiptLearning] Failed to clear old data:", clearErr);
    }
  }
}

/**
 * Extract pattern from line (normalize for learning)
 */
function extractPatternFromLine(line: string): string {
  // Normalize: replace amounts with placeholder, keep structure
  const normalized = line
    .replace(/\d+\.\d{2}/g, "AMOUNT")
    .replace(/\d+/g, "NUM")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return normalized;
}

/**
 * Generate a fingerprint for a receipt to avoid duplicate learning
 */
function generateReceiptFingerprint(text: string): string {
  // Create a simple hash from the first 200 chars of normalized text
  const normalized = text.replace(/\s+/g, "").toUpperCase().substring(0, 200);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Check if we've recently learned from this receipt (avoid duplicates)
 */
function hasRecentlyLearnedFromReceipt(data: LearningData, fingerprint: string, withinHours: number = 24): boolean {
  const cutoff = Date.now() - (withinHours * 60 * 60 * 1000);
  
  for (const extraction of data.successfulExtractions) {
    if (extraction.timestamp > cutoff) {
      const existingFingerprint = generateReceiptFingerprint(extraction.receiptText);
      if (existingFingerprint === fingerprint) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Record successful extraction
 * Includes validation to avoid learning from duplicate receipts
 */
export function recordSuccess(
  receiptText: string,
  amount: number,
  strategy: string,
  linePattern: string,
  storeName?: string,
  format?: ReceiptFormat | null
): void {
  const data = getLearningData();
  
  // VALIDATION 1: Check for duplicate receipt (don't learn same receipt multiple times)
  const fingerprint = generateReceiptFingerprint(receiptText);
  if (hasRecentlyLearnedFromReceipt(data, fingerprint, 24)) {
    console.log("[ReceiptLearning] Skipping duplicate receipt (already learned within 24h)");
    return;
  }
  
  // VALIDATION 2: Amount must be reasonable
  if (amount <= 0 || amount > 100000) {
    console.log("[ReceiptLearning] Skipping invalid amount:", amount);
    return;
  }
  
  // Find the line that contained the amount
  const lines = receiptText.split(/\n/).map(l => l.trim());
  const matchingLine = lines.find(line => 
    line.includes(linePattern) || 
    line.match(new RegExp(`\\b${amount.toFixed(2)}\\b`))
  ) || linePattern;
  
  // VALIDATION 3: Line pattern must contain the actual amount
  if (!matchingLine.includes(amount.toFixed(2))) {
    console.log("[ReceiptLearning] Skipping - line pattern doesn't contain amount");
    return;
  }

  const extraction: SuccessfulExtraction = {
    receiptText: receiptText.substring(0, 500), // Store snippet only
    extractedAmount: amount,
    storeName,
    strategy,
    linePattern: matchingLine,
    timestamp: Date.now(),
    formatId: format?.id,
  };

  data.successfulExtractions.push(extraction);

  // Update pattern success
  const pattern = extractPatternFromLine(matchingLine);
  data.patternSuccess[pattern] = (data.patternSuccess[pattern] || 0) + 1;

  // Update strategy success
  data.strategySuccess[strategy] = (data.strategySuccess[strategy] || 0) + 1;

  saveLearningData(data);

  // Queue for Supabase sync
  queueForSync({
    type: "extraction",
    data: extraction,
    timestamp: Date.now(),
  });
  
  console.log("[ReceiptLearning] Recorded successful extraction:", {
    amount,
    pattern,
    storeName,
  });
}

/**
 * Record user correction
 * This records when the system got the amount wrong and the user corrected it
 */
export function recordCorrection(
  receiptText: string,
  originalAmount: number,
  correctedAmount: number,
  correctLinePattern: string,
  storeName?: string,
  strategy?: string,
  format?: ReceiptFormat | null
): void {
  // VALIDATION 1: Corrected amount must be valid and different from original
  if (correctedAmount <= 0 || correctedAmount > 100000) {
    console.log("[ReceiptLearning] Skipping invalid correction amount:", correctedAmount);
    return;
  }
  
  if (Math.abs(correctedAmount - originalAmount) < 0.01) {
    console.log("[ReceiptLearning] Skipping - correction is same as original");
    return;
  }

  const data = getLearningData();
  
  // VALIDATION 2: Check for duplicate correction (don't record same correction multiple times)
  const fingerprint = generateReceiptFingerprint(receiptText);
  if (hasRecentlyLearnedFromReceipt(data, fingerprint, 1)) {
    console.log("[ReceiptLearning] Skipping duplicate correction (already corrected within 1h)");
    return;
  }

  const correction: Correction = {
    receiptText: receiptText.substring(0, 500), // Store snippet only
    originalAmount,
    correctedAmount,
    correctLinePattern,
    storeName,
    timestamp: Date.now(),
    strategy: strategy || "unknown",
    formatId: format?.id,
  };

  data.corrections.push(correction);

  // Find the pattern that was incorrectly used and STRONGLY mark it as failed
  const lines = receiptText.split(/\n/).map(l => l.trim());
  const incorrectLine = lines.find(line => 
    line.match(new RegExp(`\\b${originalAmount.toFixed(2)}\\b`))
  );

  if (incorrectLine) {
    const incorrectPattern = extractPatternFromLine(incorrectLine);
    // Add 2 failures for corrections (more weight than regular failures)
    data.patternFailures[incorrectPattern] = (data.patternFailures[incorrectPattern] || 0) + 2;
  }

  // Only record correct pattern if the line actually contains the corrected amount
  if (correctLinePattern.includes(correctedAmount.toFixed(2))) {
    const correctPattern = extractPatternFromLine(correctLinePattern);
    data.patternSuccess[correctPattern] = (data.patternSuccess[correctPattern] || 0) + 1;
  }

  // Record strategy failure if strategy provided
  if (strategy) {
    data.strategyFailures[strategy] = (data.strategyFailures[strategy] || 0) + 1;
  }

  saveLearningData(data);

  // Queue for Supabase sync
  queueForSync({
    type: "correction",
    data: correction,
    timestamp: Date.now(),
  });
}

/**
 * Get learned patterns sorted by success rate
 */
export function getLearnedPatterns(): LearnedPattern[] {
  const data = getLearningData();
  const patterns: Map<string, LearnedPattern> = new Map();

  // Process successful extractions
  for (const extraction of data.successfulExtractions) {
    const pattern = extractPatternFromLine(extraction.linePattern);
    const existing = patterns.get(pattern);
    
    if (existing) {
      existing.successCount++;
      existing.lastUsed = Math.max(existing.lastUsed, extraction.timestamp);
    } else {
      patterns.set(pattern, {
        pattern,
        successCount: 1,
        failureCount: 0,
        successRate: 1.0,
        lastUsed: extraction.timestamp,
        storeName: extraction.storeName,
        formatId: extraction.formatId,
      });
    }
  }

  // Process corrections (failures)
  for (const correction of data.corrections) {
    const pattern = extractPatternFromLine(correction.correctLinePattern);
    const existing = patterns.get(pattern);
    
    if (existing) {
      existing.successCount++;
      existing.lastUsed = Math.max(existing.lastUsed, correction.timestamp);
    } else {
      patterns.set(pattern, {
        pattern,
        successCount: 1,
        failureCount: 0,
        successRate: 1.0,
        lastUsed: correction.timestamp,
        storeName: correction.storeName,
        formatId: correction.formatId,
      });
    }
  }

  // Add failure counts
  for (const [pattern, failureCount] of Object.entries(data.patternFailures)) {
    const existing = patterns.get(pattern);
    if (existing) {
      existing.failureCount += failureCount;
    } else {
      patterns.set(pattern, {
        pattern,
        successCount: 0,
        failureCount,
        successRate: 0.0,
        lastUsed: Date.now(),
      });
    }
  }

  // Calculate success rates
  for (const pattern of Array.from(patterns.values())) {
    const total = pattern.successCount + pattern.failureCount;
    pattern.successRate = total > 0 ? pattern.successCount / total : 0;
  }

  // Sort by success rate (highest first), then by usage count
  return Array.from(patterns.values()).sort((a, b) => {
    if (Math.abs(a.successRate - b.successRate) > 0.1) {
      return b.successRate - a.successRate;
    }
    return (b.successCount + b.failureCount) - (a.successCount + a.failureCount);
  });
}

/**
 * Get strategy success rates
 */
export function getStrategySuccessRates(): Record<string, { success: number; failure: number; rate: number }> {
  const data = getLearningData();
  const rates: Record<string, { success: number; failure: number; rate: number }> = {};

  for (const [strategy, success] of Object.entries(data.strategySuccess)) {
    const failure = data.strategyFailures[strategy] || 0;
    const total = success + failure;
    rates[strategy] = {
      success,
      failure,
      rate: total > 0 ? success / total : 0.5, // Default to 0.5 if no data
    };
  }

  return rates;
}

/**
 * Get recommended strategies sorted by success rate
 */
export function getRecommendedStrategies(): string[] {
  const rates = getStrategySuccessRates();
  return Object.entries(rates)
    .sort((a, b) => b[1].rate - a[1].rate)
    .map(([strategy]) => strategy);
}

// Minimum success rate to trust a pattern (0.7 = 70%)
const MIN_SUCCESS_RATE = 0.7;
// Minimum number of successes before trusting a pattern
const MIN_SUCCESS_COUNT = 2;
// Pattern expiration time (7 days in milliseconds)
const PATTERN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Apply learned patterns to extraction hints
 * Returns patterns that should be prioritized
 * STRICT MATCHING: Only applies patterns with high confidence and exact matches
 */
export function applyLearnedPatterns(
  text: string,
  storeName?: string,
  formatId?: string
): Array<{ pattern: string; priority: number }> {
  const learnedPatterns = getLearnedPatterns();
  const lines = text.split(/\n/).map(l => l.trim());
  const hints: Array<{ pattern: string; priority: number }> = [];
  const now = Date.now();

  for (const learned of learnedPatterns) {
    // VALIDATION 1: Skip patterns with low success rate
    if (learned.successRate < MIN_SUCCESS_RATE) {
      continue;
    }

    // VALIDATION 2: Skip patterns that haven't been confirmed multiple times
    if (learned.successCount < MIN_SUCCESS_COUNT) {
      continue;
    }

    // VALIDATION 3: Skip old/stale patterns (reduce priority significantly)
    const patternAge = now - learned.lastUsed;
    if (patternAge > PATTERN_EXPIRATION_MS) {
      // Pattern is old - don't apply it automatically
      continue;
    }

    // VALIDATION 4: Filter by store/format if provided (strict matching)
    if (storeName && learned.storeName && learned.storeName !== storeName) {
      continue;
    }
    if (formatId && learned.formatId && learned.formatId !== formatId) {
      continue;
    }

    // VALIDATION 5: Check if any line EXACTLY matches this pattern (no substring matches)
    for (const line of lines) {
      const linePattern = extractPatternFromLine(line);
      
      // STRICT: Only exact pattern matches (not substring matches)
      if (linePattern === learned.pattern) {
        // Calculate priority based on success rate, usage, and recency
        const usageScore = Math.min(learned.successCount, 10) / 10;
        const recencyScore = Math.max(0, 1 - (patternAge / PATTERN_EXPIRATION_MS));
        
        // Priority formula: success rate matters most, then recency, then usage
        const priority = learned.successRate * 5 + recencyScore * 3 + usageScore * 2;
        
        hints.push({
          pattern: learned.pattern,
          priority,
        });
        break; // Only add once per pattern
      }
    }
  }

  return hints.sort((a, b) => b.priority - a.priority);
}

/**
 * Clear all learning data (for testing/reset)
 * Clears local learning data, sync queue, and global patterns cache
 */
export function clearLearningData(): void {
  if (typeof window === "undefined") return;
  
  // Clear local learning data
  localStorage.removeItem(STORAGE_KEY);
  
  // Clear sync queue
  localStorage.removeItem(SYNC_QUEUE_KEY);
  
  // Clear global patterns cache
  localStorage.removeItem(GLOBAL_PATTERNS_KEY);
  
  // Clear last sync timestamp
  localStorage.removeItem(LAST_SYNC_KEY);
  
  console.log("[ReceiptLearning] All learning data cleared");
}

/**
 * Get learning data summary for UI display
 */
export function getLearningDataSummary(): {
  totalPatterns: number;
  totalSuccesses: number;
  totalCorrections: number;
  avgSuccessRate: number;
  oldestPatternAge: number; // in days
  syncQueueSize: number;
} {
  const data = getLearningData();
  const patterns = getLearnedPatterns();
  const syncQueue = getSyncQueue();
  
  const now = Date.now();
  let oldestTimestamp = now;
  
  for (const extraction of data.successfulExtractions) {
    if (extraction.timestamp < oldestTimestamp) {
      oldestTimestamp = extraction.timestamp;
    }
  }
  
  const totalPatternSuccess = patterns.reduce((sum, p) => sum + p.successCount, 0);
  const totalPatternFailure = patterns.reduce((sum, p) => sum + p.failureCount, 0);
  const totalPattern = totalPatternSuccess + totalPatternFailure;
  const avgSuccessRate = totalPattern > 0 ? totalPatternSuccess / totalPattern : 0;
  
  return {
    totalPatterns: patterns.length,
    totalSuccesses: data.successfulExtractions.length,
    totalCorrections: data.corrections.length,
    avgSuccessRate,
    oldestPatternAge: Math.floor((now - oldestTimestamp) / (24 * 60 * 60 * 1000)),
    syncQueueSize: syncQueue.length,
  };
}

/**
 * Record format detection success (store name was correctly detected)
 */
export function recordFormatDetectionSuccess(
  storeName: string,
  format: ReceiptFormat | null,
  ocrText: string
): void {
  const data = getLearningData();
  
  const detection: FormatDetection = {
    detectedStoreName: storeName,
    correctStoreName: storeName,
    ocrText: ocrText.substring(0, 500), // Store snippet only
    formatId: format?.id,
    timestamp: Date.now(),
    wasCorrect: true,
  };

  if (!data.formatDetections) {
    data.formatDetections = [];
  }
  data.formatDetections.push(detection);

  // Update format detection success count
  data.formatDetectionSuccess[storeName] = (data.formatDetectionSuccess[storeName] || 0) + 1;

  saveLearningData(data);

  // Queue for Supabase sync
  queueForSync({
    type: "formatDetection",
    data: detection,
    timestamp: Date.now(),
  });
}

/**
 * Record format detection failure (store name was incorrectly detected)
 */
export function recordFormatDetectionFailure(
  detectedStoreName: string,
  correctStoreName: string,
  ocrText: string,
  format?: ReceiptFormat | null
): void {
  const data = getLearningData();

  const detection: FormatDetection = {
    detectedStoreName,
    correctStoreName,
    ocrText: ocrText.substring(0, 500), // Store snippet only
    formatId: format?.id,
    timestamp: Date.now(),
    wasCorrect: false,
  };

  if (!data.formatDetections) {
    data.formatDetections = [];
  }
  data.formatDetections.push(detection);

  // Update format detection failure count
  data.formatDetectionFailures[detectedStoreName] = (data.formatDetectionFailures[detectedStoreName] || 0) + 1;
  
  // Also record success for correct store name if different
  if (correctStoreName !== detectedStoreName) {
    data.formatDetectionSuccess[correctStoreName] = (data.formatDetectionSuccess[correctStoreName] || 0) + 1;
  }

  saveLearningData(data);

  // Queue for Supabase sync
  queueForSync({
    type: "formatDetection",
    data: detection,
    timestamp: Date.now(),
  });
}

/**
 * Get format detection accuracy for a specific store name
 */
export function getFormatDetectionAccuracy(storeName: string): number {
  const data = getLearningData();
  const success = data.formatDetectionSuccess[storeName] || 0;
  const failure = data.formatDetectionFailures[storeName] || 0;
  const total = success + failure;
  
  return total > 0 ? success / total : 0.5; // Default to 0.5 if no data
}

/**
 * Get learning statistics
 */
export function getLearningStats(): {
  totalSuccesses: number;
  totalCorrections: number;
  patternCount: number;
  strategyCount: number;
  avgSuccessRate: number;
  formatDetections: number;
} {
  const data = getLearningData();
  const patterns = getLearnedPatterns();
  const strategies = getStrategySuccessRates();

  const totalPatternSuccess = patterns.reduce((sum, p) => sum + p.successCount, 0);
  const totalPatternFailure = patterns.reduce((sum, p) => sum + p.failureCount, 0);
  const totalPattern = totalPatternSuccess + totalPatternFailure;
  const avgSuccessRate = totalPattern > 0 ? totalPatternSuccess / totalPattern : 0;

  return {
    totalSuccesses: data.successfulExtractions.length,
    totalCorrections: data.corrections.length,
    patternCount: patterns.length,
    strategyCount: Object.keys(strategies).length,
    avgSuccessRate,
    formatDetections: data.formatDetections?.length || 0,
  };
}

// ============================================
// Supabase Sync Functions
// ============================================

const SYNC_QUEUE_KEY = "receipt_ocr_sync_queue";
const GLOBAL_PATTERNS_KEY = "receipt_ocr_global_patterns";
const LAST_SYNC_KEY = "receipt_ocr_last_sync";

interface SyncQueueItem {
  type: "extraction" | "correction" | "formatDetection";
  data: SuccessfulExtraction | Correction | FormatDetection;
  timestamp: number;
}

interface GlobalPatternData {
  patterns: LearnedPattern[];
  strategies: Record<string, { success: number; failure: number; rate: number }>;
  fetchedAt: number;
}

/**
 * Queue an item for sync to Supabase
 */
export function queueForSync(item: SyncQueueItem): void {
  if (typeof window === "undefined") return;

  try {
    const queue = getSyncQueue();
    queue.push(item);
    
    // Limit queue size
    const maxQueueSize = 100;
    if (queue.length > maxQueueSize) {
      queue.splice(0, queue.length - maxQueueSize);
    }
    
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("[ReceiptLearning] Failed to queue for sync:", err);
  }
}

/**
 * Get sync queue from localStorage
 */
function getSyncQueue(): SyncQueueItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(SYNC_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    return [];
  }
}

/**
 * Clear sync queue
 */
function clearSyncQueue(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

/**
 * Process sync queue - upload items to Supabase
 * Returns number of items synced
 */
export async function processSyncQueue(): Promise<number> {
  if (typeof window === "undefined") return 0;

  const queue = getSyncQueue();
  if (queue.length === 0) return 0;

  try {
    // Dynamically import server actions to avoid SSR issues
    const { saveExtractionSuccess, saveCorrection, saveFormatDetection } = await import("@/app/jobs/ocr-learning-actions");

    let synced = 0;

    for (const item of queue) {
      try {
        let result: { ok: boolean };

        switch (item.type) {
          case "extraction":
            const extraction = item.data as SuccessfulExtraction;
            result = await saveExtractionSuccess({
              receiptText: extraction.receiptText,
              extractedAmount: extraction.extractedAmount,
              storeName: extraction.storeName,
              strategy: extraction.strategy,
              linePattern: extraction.linePattern,
              formatId: extraction.formatId,
            });
            break;

          case "correction":
            const correction = item.data as Correction;
            result = await saveCorrection({
              receiptText: correction.receiptText,
              originalAmount: correction.originalAmount,
              correctedAmount: correction.correctedAmount,
              correctLinePattern: correction.correctLinePattern,
              storeName: correction.storeName,
              strategy: correction.strategy,
              formatId: correction.formatId,
            });
            break;

          case "formatDetection":
            const detection = item.data as FormatDetection;
            result = await saveFormatDetection({
              detectedStoreName: detection.detectedStoreName,
              correctStoreName: detection.correctStoreName,
              ocrTextSnippet: detection.ocrText,
              formatId: detection.formatId,
              wasCorrect: detection.wasCorrect,
            });
            break;

          default:
            result = { ok: true };
        }

        if (result.ok) {
          synced++;
        }
      } catch (itemErr) {
        console.error("[ReceiptLearning] Failed to sync item:", itemErr);
      }
    }

    // Clear successfully synced items
    if (synced > 0) {
      clearSyncQueue();
      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    }

    return synced;
  } catch (err) {
    console.error("[ReceiptLearning] Failed to process sync queue:", err);
    return 0;
  }
}

/**
 * Fetch global patterns from Supabase
 */
export async function fetchGlobalPatterns(): Promise<GlobalPatternData | null> {
  if (typeof window === "undefined") return null;

  try {
    const { getGlobalPatternStats, getGlobalStrategyStats } = await import("@/app/jobs/ocr-learning-actions");

    const [patternsResult, strategiesResult] = await Promise.all([
      getGlobalPatternStats(),
      getGlobalStrategyStats(),
    ]);

    if (!patternsResult.ok || !strategiesResult.ok) {
      return null;
    }

    const globalData: GlobalPatternData = {
      patterns: (patternsResult.patterns || []).map((p) => ({
        pattern: p.pattern,
        successCount: p.successCount,
        failureCount: p.failureCount,
        successRate: p.successRate,
        lastUsed: Date.now(),
        storeName: p.storeName,
        formatId: p.formatId,
      })),
      strategies: strategiesResult.strategies || {},
      fetchedAt: Date.now(),
    };

    // Cache global patterns locally
    localStorage.setItem(GLOBAL_PATTERNS_KEY, JSON.stringify(globalData));

    return globalData;
  } catch (err) {
    console.error("[ReceiptLearning] Failed to fetch global patterns:", err);
    return null;
  }
}

/**
 * Get cached global patterns
 */
export function getCachedGlobalPatterns(): GlobalPatternData | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(GLOBAL_PATTERNS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("[ReceiptLearning] Failed to get cached global patterns:", err);
  }

  return null;
}

/**
 * Merge local and global patterns
 * Returns combined patterns with higher confidence from global data
 */
export function getMergedPatterns(): LearnedPattern[] {
  const localPatterns = getLearnedPatterns();
  const globalData = getCachedGlobalPatterns();

  if (!globalData || !globalData.patterns) {
    return localPatterns;
  }

  const mergedMap = new Map<string, LearnedPattern>();

  // Add local patterns first
  for (const pattern of localPatterns) {
    mergedMap.set(pattern.pattern, { ...pattern });
  }

  // Merge global patterns (add to existing or create new)
  for (const globalPattern of globalData.patterns) {
    const existing = mergedMap.get(globalPattern.pattern);
    if (existing) {
      // Combine counts
      existing.successCount += globalPattern.successCount;
      existing.failureCount += globalPattern.failureCount;
      // Recalculate success rate
      const total = existing.successCount + existing.failureCount;
      existing.successRate = total > 0 ? existing.successCount / total : 0;
    } else {
      mergedMap.set(globalPattern.pattern, { ...globalPattern });
    }
  }

  // Sort by success rate and usage
  return Array.from(mergedMap.values()).sort((a, b) => {
    if (Math.abs(a.successRate - b.successRate) > 0.1) {
      return b.successRate - a.successRate;
    }
    return (b.successCount + b.failureCount) - (a.successCount + a.failureCount);
  });
}

/**
 * Get merged strategy success rates (local + global)
 */
export function getMergedStrategyRates(): Record<string, { success: number; failure: number; rate: number }> {
  const localRates = getStrategySuccessRates();
  const globalData = getCachedGlobalPatterns();

  if (!globalData || !globalData.strategies) {
    return localRates;
  }

  const merged: Record<string, { success: number; failure: number; rate: number }> = { ...localRates };

  for (const [strategy, globalStats] of Object.entries(globalData.strategies)) {
    if (merged[strategy]) {
      merged[strategy].success += globalStats.success;
      merged[strategy].failure += globalStats.failure;
      const total = merged[strategy].success + merged[strategy].failure;
      merged[strategy].rate = total > 0 ? merged[strategy].success / total : 0.5;
    } else {
      merged[strategy] = { ...globalStats };
    }
  }

  return merged;
}

/**
 * Check if sync is needed (called periodically)
 */
export function shouldSync(): boolean {
  if (typeof window === "undefined") return false;

  const queue = getSyncQueue();
  if (queue.length === 0) return false;

  // Check if last sync was more than 5 minutes ago
  const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) || "0", 10);
  const fiveMinutes = 5 * 60 * 1000;
  
  return Date.now() - lastSync > fiveMinutes;
}

/**
 * Check if global patterns need refresh (called periodically)
 */
export function shouldRefreshGlobalPatterns(): boolean {
  if (typeof window === "undefined") return false;

  const globalData = getCachedGlobalPatterns();
  if (!globalData) return true;

  // Refresh if older than 1 hour
  const oneHour = 60 * 60 * 1000;
  return Date.now() - globalData.fetchedAt > oneHour;
}

