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

export interface LearningData {
  successfulExtractions: SuccessfulExtraction[];
  corrections: Correction[];
  patternSuccess: Record<string, number>; // Pattern -> success count
  strategySuccess: Record<string, number>; // Strategy -> success count
  patternFailures: Record<string, number>; // Pattern -> failure count
  strategyFailures: Record<string, number>; // Strategy -> failure count
}

/**
 * Get learning data from localStorage
 */
function getLearningData(): LearningData {
  if (typeof window === "undefined") {
    return {
      successfulExtractions: [],
      corrections: [],
      patternSuccess: {},
      strategySuccess: {},
      patternFailures: {},
      strategyFailures: {},
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("[ReceiptLearning] Failed to load learning data:", err);
  }

  return {
    successfulExtractions: [],
    corrections: [],
    patternSuccess: {},
    strategySuccess: {},
    patternFailures: {},
    strategyFailures: {},
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("[ReceiptLearning] Failed to save learning data:", err);
    // If storage is full, try to clear old data
    try {
      const cleared = {
        ...data,
        successfulExtractions: data.successfulExtractions.slice(-maxItems / 2),
        corrections: data.corrections.slice(-maxItems / 2),
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
 * Record successful extraction
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
  
  // Find the line that contained the amount
  const lines = receiptText.split(/\n/).map(l => l.trim());
  const matchingLine = lines.find(line => 
    line.includes(linePattern) || 
    line.match(new RegExp(`\\b${amount.toFixed(2)}\\b`))
  ) || linePattern;

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
}

/**
 * Record user correction
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
  const data = getLearningData();

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

  // Find the pattern that was incorrectly used
  const lines = receiptText.split(/\n/).map(l => l.trim());
  const incorrectLine = lines.find(line => 
    line.match(new RegExp(`\\b${originalAmount.toFixed(2)}\\b`))
  );

  if (incorrectLine) {
    const incorrectPattern = extractPatternFromLine(incorrectLine);
    data.patternFailures[incorrectPattern] = (data.patternFailures[incorrectPattern] || 0) + 1;
  }

  // Record correct pattern
  const correctPattern = extractPatternFromLine(correctLinePattern);
  data.patternSuccess[correctPattern] = (data.patternSuccess[correctPattern] || 0) + 1;

  // Record strategy failure if strategy provided
  if (strategy) {
    data.strategyFailures[strategy] = (data.strategyFailures[strategy] || 0) + 1;
  }

  saveLearningData(data);
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

/**
 * Apply learned patterns to extraction hints
 * Returns patterns that should be prioritized
 */
export function applyLearnedPatterns(
  text: string,
  storeName?: string,
  formatId?: string
): Array<{ pattern: string; priority: number }> {
  const learnedPatterns = getLearnedPatterns();
  const lines = text.split(/\n/).map(l => l.trim());
  const hints: Array<{ pattern: string; priority: number }> = [];

  for (const learned of learnedPatterns) {
    // Filter by store/format if provided
    if (storeName && learned.storeName && learned.storeName !== storeName) {
      continue;
    }
    if (formatId && learned.formatId && learned.formatId !== formatId) {
      continue;
    }

    // Check if any line matches this pattern
    for (const line of lines) {
      const linePattern = extractPatternFromLine(line);
      if (linePattern === learned.pattern || linePattern.includes(learned.pattern)) {
        // Calculate priority based on success rate and usage
        const usageScore = Math.min(learned.successCount + learned.failureCount, 10) / 10;
        const priority = learned.successRate * 10 + usageScore * 2;
        
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
 */
export function clearLearningData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
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
  };
}

