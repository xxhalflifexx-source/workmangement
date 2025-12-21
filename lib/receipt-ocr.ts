/**
 * Utility functions for extracting amounts from receipt text using OCR
 */

/**
 * Extract currency amount from OCR text
 * Optimized for various receipt formats: retail, restaurant, gas station, credit card receipts
 */
export function extractAmountFromText(text: string): number | null {
  if (!text) return null;

  // Preserve line structure for better analysis
  const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);
  const normalizedText = text.replace(/\s+/g, " ").trim();

  // Track amounts with their context (which line, priority score)
  interface AmountWithContext {
    amount: number;
    line: string;
    priority: number; // Higher = more likely to be the total
    keyword: string; // Which keyword was found
  }

  const amountCandidates: AmountWithContext[] = [];

  // Priority 1: Lines containing "Total" or "Grand Total" (highest priority)
  for (const line of lines) {
    const totalMatch = line.match(/(?:^|\s)(?:total|grand\s*total|final\s*total)[:\s]*\$?\s*(\d+\.\d{2})/i);
    if (totalMatch) {
      const amount = parseFloat(totalMatch[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amountCandidates.push({
          amount,
          line,
          priority: 10,
          keyword: "total",
        });
      }
    }

    // Also check for amount at end of line with "total" keyword
    if (/total|grand\s*total/i.test(line)) {
      const endMatch = line.match(/(\d+\.\d{2})\s*$/);
      if (endMatch) {
        const amount = parseFloat(endMatch[1]);
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          amountCandidates.push({
            amount,
            line,
            priority: 10,
            keyword: "total",
          });
        }
      }
    }
  }

  // Priority 2: Lines containing "Amount Due" or "Balance Due"
  for (const line of lines) {
    const dueMatch = line.match(/(?:amount\s*due|balance\s*due)[:\s]*\$?\s*(\d+\.\d{2})/i);
    if (dueMatch) {
      const amount = parseFloat(dueMatch[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amountCandidates.push({
          amount,
          line,
          priority: 9,
          keyword: "amount due",
        });
      }
    }
  }

  // Priority 3: Credit card amount patterns (VISA #XXXX Amount, etc.)
  for (const line of lines) {
    const cardMatch = line.match(/(?:visa|mastercard|amex|discover|card)[\s#:]*\d*[\s:]*(\d+\.\d{2})/i);
    if (cardMatch) {
      const amount = parseFloat(cardMatch[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amountCandidates.push({
          amount,
          line,
          priority: 8,
          keyword: "card",
        });
      }
    }
  }

  // Priority 4: Amounts at end of lines (likely totals)
  for (const line of lines) {
    const endMatch = line.match(/\$(\d+\.\d{2})\s*$/);
    if (endMatch) {
      const amount = parseFloat(endMatch[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        // Lower priority unless line has relevant keywords
        const hasKeyword = /total|amount|sum|balance|due|paid/i.test(line);
        amountCandidates.push({
          amount,
          line,
          priority: hasKeyword ? 7 : 3,
          keyword: hasKeyword ? "end with keyword" : "end of line",
        });
      }
    }
  }

  // Priority 5: Pattern matching in normalized text (fallback)
  const totalPatterns = [
    /(?:total|grand\s*total|amount\s*due|balance\s*due)[:\s]*\$?\s*(\d+\.\d{2})/gi,
    /(?:total|amount|sum|balance|due|paid)[:\s]*(\d+\.\d{2})/gi,
  ];

  for (const pattern of totalPatterns) {
    const matches = Array.from(normalizedText.matchAll(pattern));
    for (const match of matches) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        // Check if we already have this amount with higher priority
        const existing = amountCandidates.find(c => c.amount === amount && c.priority >= 5);
        if (!existing) {
          amountCandidates.push({
            amount,
            line: normalizedText.substring(Math.max(0, match.index! - 30), match.index! + 30),
            priority: 5,
            keyword: "pattern match",
          });
        }
      }
    }
  }

  // If no high-priority matches, find all amounts as fallback
  if (amountCandidates.length === 0) {
    const allAmountsPattern = /(\d+\.\d{2})/g;
    const allMatches = Array.from(normalizedText.matchAll(allAmountsPattern));
    for (const match of allMatches) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amountCandidates.push({
          amount,
          line: normalizedText.substring(Math.max(0, match.index! - 30), match.index! + 30),
          priority: 1,
          keyword: "any amount",
        });
      }
    }
  }

  if (amountCandidates.length === 0) {
    return null;
  }

  // Sort by priority (highest first), then by amount (largest first)
  amountCandidates.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return b.amount - a.amount;
  });

  // Check for duplicate amounts (if same amount appears multiple times, it's likely the total)
  const amountCounts = new Map<number, number>();
  amountCandidates.forEach(c => {
    amountCounts.set(c.amount, (amountCounts.get(c.amount) || 0) + 1);
  });

  // If an amount appears multiple times and has high priority, prefer it
  const duplicateAmounts = Array.from(amountCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([amount]) => amount);

  if (duplicateAmounts.length > 0) {
    // Find the highest priority duplicate amount
    for (const candidate of amountCandidates) {
      if (duplicateAmounts.includes(candidate.amount) && candidate.priority >= 5) {
        return candidate.amount;
      }
    }
  }

  // Return the highest priority amount
  return amountCandidates[0].amount;
}

/**
 * Extract multiple potential amounts and return them sorted with context
 * Useful for showing user options
 */
export function extractAllAmounts(text: string): number[] {
  if (!text) return [];

  const amounts: number[] = [];
  const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);

  // Extract amounts from lines with context
  for (const line of lines) {
    // Find amounts in this line
    const matches = Array.from(line.matchAll(/(\d+\.\d{2})/g));
    for (const match of matches) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amounts.push(amount);
      }
    }
  }

  // Also check normalized text for any missed amounts
  const normalizedText = text.replace(/\s+/g, " ");
  const allMatches = Array.from(normalizedText.matchAll(/(\d+\.\d{2})/g));
  for (const match of allMatches) {
    const amount = parseFloat(match[1]);
    if (!isNaN(amount) && amount > 0 && amount < 1000000) {
      amounts.push(amount);
    }
  }

  // Remove duplicates and sort descending
  return Array.from(new Set(amounts)).sort((a, b) => b - a);
}

/**
 * Extract amounts with their context (which line they came from)
 * Returns array of { amount, line, keyword } objects
 */
export function extractAmountsWithContext(text: string): Array<{ amount: number; line: string; keyword: string }> {
  if (!text) return [];

  const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);
  const results: Array<{ amount: number; line: string; keyword: string }> = [];

  for (const line of lines) {
    // Check for total patterns
    if (/total|grand\s*total/i.test(line)) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match) {
        const amount = parseFloat(match[1]);
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          results.push({ amount, line, keyword: "Total" });
        }
      }
    }

    // Check for amount due
    if (/amount\s*due|balance\s*due/i.test(line)) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match) {
        const amount = parseFloat(match[1]);
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          results.push({ amount, line, keyword: "Amount Due" });
        }
      }
    }

    // Check for credit card amounts
    if (/(?:visa|mastercard|amex|discover|card)/i.test(line)) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match) {
        const amount = parseFloat(match[1]);
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          results.push({ amount, line, keyword: "Card Payment" });
        }
      }
    }
  }

  // Remove duplicates (same amount from same line)
  const unique = results.filter((item, index, self) =>
    index === self.findIndex(t => t.amount === item.amount && t.line === item.line)
  );

  return unique.sort((a, b) => b.amount - a.amount);
}

