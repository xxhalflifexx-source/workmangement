/**
 * Utility functions for extracting amounts from receipt text using OCR
 */

/**
 * Extract currency amount from OCR text
 * Looks for patterns like: $XX.XX, Total: $XX.XX, Amount: XX.XX, etc.
 */
export function extractAmountFromText(text: string): number | null {
  if (!text) return null;

  // Normalize text - remove extra whitespace and newlines
  const normalizedText = text.replace(/\s+/g, " ").trim();

  // Patterns to match currency amounts
  const patterns = [
    // Total: $XX.XX or TOTAL: $XX.XX
    /(?:total|amount|sum|balance|due|paid)[:\s]*\$?\s*(\d+\.\d{2})/i,
    // $XX.XX at end of line (likely total)
    /\$(\d+\.\d{2})\s*$/m,
    // XX.XX with two decimal places (most likely total)
    /(\d+\.\d{2})/g,
  ];

  const amounts: number[] = [];

  // Try pattern matching
  for (const pattern of patterns) {
    const matches = Array.from(normalizedText.matchAll(pattern));
    for (const match of matches) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        // Reasonable range for expenses
        amounts.push(amount);
      }
    }
  }

  // If we found amounts, return the largest one (likely the total)
  if (amounts.length > 0) {
    return Math.max(...amounts);
  }

  // Fallback: look for any number with 2 decimal places
  const fallbackMatch = normalizedText.match(/(\d+\.\d{2})/);
  if (fallbackMatch) {
    const amount = parseFloat(fallbackMatch[1]);
    if (!isNaN(amount) && amount > 0) {
      return amount;
    }
  }

  return null;
}

/**
 * Extract multiple potential amounts and return them sorted
 * Useful for showing user options
 */
export function extractAllAmounts(text: string): number[] {
  if (!text) return [];

  const amounts: number[] = [];
  const matches = Array.from(text.matchAll(/(\d+\.\d{2})/g));

  for (const match of matches) {
    const amount = parseFloat(match[1]);
    if (!isNaN(amount) && amount > 0 && amount < 1000000) {
      amounts.push(amount);
    }
  }

  // Remove duplicates and sort descending
  return [...new Set(amounts)].sort((a, b) => b - a);
}

