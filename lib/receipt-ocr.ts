/**
 * Utility functions for extracting amounts from receipt text using OCR
 */

/**
 * Extract currency amount from OCR text
 * Looks for patterns like: $XX.XX, Total: $XX.XX, Amount: XX.XX, etc.
 */
export function extractAmountFromText(text: string): number | null {
  if (!text) return null;

  // Normalize text - remove extra whitespace and newlines, but preserve structure
  const normalizedText = text.replace(/\s+/g, " ").trim();
  
  // Also try with newlines preserved for better pattern matching
  const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);

  const amounts: number[] = [];

  // Pattern 1: Look for "Total", "Amount", "Sum", etc. followed by currency
  const totalPatterns = [
    /(?:total|amount|sum|balance|due|paid|grand\s*total|final\s*amount)[:\s]*\$?\s*(\d+\.\d{2})/i,
    /(?:total|amount|sum|balance|due|paid)[:\s]*(\d+\.\d{2})/i,
  ];

  for (const pattern of totalPatterns) {
    const matches = Array.from(normalizedText.matchAll(pattern));
    for (const match of matches) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amounts.push(amount);
      }
    }
  }

  // Pattern 2: Look for amounts at end of lines (likely totals)
  for (const line of lines) {
    // Match $XX.XX at end of line
    const endMatch = line.match(/\$(\d+\.\d{2})\s*$/);
    if (endMatch) {
      const amount = parseFloat(endMatch[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amounts.push(amount);
      }
    }
    
    // Match XX.XX at end of line (if line contains "total" or similar)
    if (/total|amount|sum|balance|due/i.test(line)) {
      const amountMatch = line.match(/(\d+\.\d{2})\s*$/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1]);
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          amounts.push(amount);
        }
      }
    }
  }

  // Pattern 3: Find all amounts with 2 decimal places
  const allAmountsPattern = /(\d+\.\d{2})/g;
  const allMatches = Array.from(normalizedText.matchAll(allAmountsPattern));
  for (const match of allMatches) {
    const amount = parseFloat(match[1]);
    if (!isNaN(amount) && amount > 0 && amount < 1000000) {
      amounts.push(amount);
    }
  }

  // If we found amounts, return the largest one (likely the total)
  if (amounts.length > 0) {
    // Prefer amounts that appeared with "total" keywords
    const totalAmounts = amounts.filter((amt, idx) => {
      // Check if this amount appeared near a total keyword
      const amountStr = amt.toFixed(2);
      return /total|amount|sum|balance|due/i.test(
        normalizedText.substring(Math.max(0, normalizedText.indexOf(amountStr) - 20), normalizedText.indexOf(amountStr) + 20)
      );
    });
    
    if (totalAmounts.length > 0) {
      return Math.max(...totalAmounts);
    }
    
    return Math.max(...amounts);
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
  return Array.from(new Set(amounts)).sort((a, b) => b - a);
}

