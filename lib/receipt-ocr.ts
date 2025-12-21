/**
 * Utility functions for extracting amounts from receipt text using OCR
 */

/**
 * Extract amount from multiple OCR results using voting mechanism
 * Returns the most common amount found across multiple attempts
 */
export function extractAmountFromMultipleResults(
  results: Array<{ text: string; confidence: number }>
): number | null {
  if (!results || results.length === 0) return null;

  const amountVotes = new Map<number, { count: number; totalConfidence: number }>();

  // Collect amounts from all results
  for (const result of results) {
    const amount = extractAmountFromText(result.text);
    if (amount !== null) {
      const existing = amountVotes.get(amount);
      if (existing) {
        existing.count++;
        existing.totalConfidence += result.confidence;
      } else {
        amountVotes.set(amount, {
          count: 1,
          totalConfidence: result.confidence,
        });
      }
    }
  }

  if (amountVotes.size === 0) return null;

  // Find amount with most votes, breaking ties with confidence
  let bestAmount: number | null = null;
  let bestScore = 0;

  // Convert Map entries to array for iteration compatibility
  const entries = Array.from(amountVotes.entries());
  for (const [amount, { count, totalConfidence }] of entries) {
    const avgConfidence = totalConfidence / count;
    const score = count * 10 + avgConfidence; // Votes weighted more than confidence

    if (score > bestScore) {
      bestScore = score;
      bestAmount = amount;
    }
  }

  return bestAmount;
}

/**
 * Extract currency amount from OCR text
 * Optimized for various receipt formats: retail, restaurant, gas station, credit card receipts
 */
export function extractAmountFromText(text: string): number | null {
  if (!text) return null;

  // Preserve line structure for better analysis
  const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);
  const normalizedText = text.replace(/\s+/g, " ").trim();

  // Track amounts with their context (which line, priority score, position)
  interface AmountWithContext {
    amount: number;
    line: string;
    priority: number; // Higher = more likely to be the total
    keyword: string; // Which keyword was found
    lineIndex: number; // Position in receipt (0 = top, higher = bottom)
    isBottomSection: boolean; // True if in bottom 30% of receipt
  }

  const amountCandidates: AmountWithContext[] = [];
  const totalLines = lines.length;
  const bottomThreshold = Math.floor(totalLines * 0.7); // Bottom 30% of receipt

  // Priority 1: Lines containing "Total" or "Grand Total" (highest priority)
  // Prioritize amounts in bottom section of receipt
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBottomSection = i >= bottomThreshold;
    const totalMatch = line.match(/(?:^|\s)(?:total|grand\s*total|final\s*total)[:\s]*\$?\s*(\d+\.\d{2})/i);
    if (totalMatch) {
      const amount = parseFloat(totalMatch[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amountCandidates.push({
          amount,
          line,
          priority: isBottomSection ? 12 : 10, // Higher priority if in bottom section
          keyword: "total",
          lineIndex: i,
          isBottomSection,
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
            priority: isBottomSection ? 12 : 10,
            keyword: "total",
            lineIndex: i,
            isBottomSection,
          });
        }
      }
    }
  }

  // Priority 2: Lines containing "Amount Due" or "Balance Due"
  // Prioritize bottom section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBottomSection = i >= bottomThreshold;
    const dueMatch = line.match(/(?:amount\s*due|balance\s*due)[:\s]*\$?\s*(\d+\.\d{2})/i);
    if (dueMatch) {
      const amount = parseFloat(dueMatch[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amountCandidates.push({
          amount,
          line,
          priority: isBottomSection ? 11 : 9,
          keyword: "amount due",
          lineIndex: i,
          isBottomSection,
        });
      }
    }
  }

  // Priority 3: Credit card amount patterns (VISA #XXXX Amount, etc.)
  // Usually at bottom of receipt
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBottomSection = i >= bottomThreshold;
    const cardMatch = line.match(/(?:visa|mastercard|amex|discover|card)[\s#:]*\d*[\s:]*(\d+\.\d{2})/i);
    if (cardMatch) {
      const amount = parseFloat(cardMatch[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        amountCandidates.push({
          amount,
          line,
          priority: isBottomSection ? 9 : 8,
          keyword: "card",
          lineIndex: i,
          isBottomSection,
        });
      }
    }
  }

  // Priority 4: Amounts at end of lines (likely totals)
  // Filter out small amounts that are likely item prices
  // Prefer amounts in bottom section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBottomSection = i >= bottomThreshold;
    const endMatch = line.match(/\$(\d+\.\d{2})\s*$/);
    if (endMatch) {
      const amount = parseFloat(endMatch[1]);
      // Filter out very small amounts (< $1) unless in bottom section with keywords
      const hasKeyword = /total|amount|sum|balance|due|paid/i.test(line);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        // Skip very small amounts unless they're clearly totals
        if (amount < 1 && !hasKeyword && !isBottomSection) {
          continue;
        }
        
        let priority = hasKeyword ? 7 : 3;
        if (isBottomSection) {
          priority += 2; // Boost priority for bottom section
        }
        
        amountCandidates.push({
          amount,
          line,
          priority,
          keyword: hasKeyword ? "end with keyword" : "end of line",
          lineIndex: i,
          isBottomSection,
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
          // Try to determine if this is in bottom section
          const matchPosition = match.index || 0;
          const textBeforeMatch = normalizedText.substring(0, matchPosition);
          const linesBeforeMatch = textBeforeMatch.split(/\s+/).length;
          const isBottomSection = linesBeforeMatch >= totalLines * 0.7;
          
          amountCandidates.push({
            amount,
            line: normalizedText.substring(Math.max(0, match.index! - 30), match.index! + 30),
            priority: isBottomSection ? 6 : 5,
            keyword: "pattern match",
            lineIndex: Math.floor(linesBeforeMatch),
            isBottomSection,
          });
        }
      }
    }
  }

  // If no high-priority matches, find all amounts as fallback
  // But prioritize amounts from bottom section
  if (amountCandidates.length === 0) {
    const allAmountsPattern = /(\d+\.\d{2})/g;
    const allMatches = Array.from(normalizedText.matchAll(allAmountsPattern));
    
    // Try to find amounts in bottom section of lines
    const bottomLines = lines.slice(bottomThreshold);
    const bottomText = bottomLines.join(" ");
    
    for (const match of Array.from(bottomText.matchAll(allAmountsPattern))) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        // Filter out very small amounts
        if (amount >= 1) {
          amountCandidates.push({
            amount,
            line: bottomText.substring(Math.max(0, match.index! - 30), match.index! + 30),
            priority: 2, // Higher priority for bottom section amounts
            keyword: "bottom section",
            lineIndex: bottomThreshold + Math.floor(match.index! / 50), // Approximate
            isBottomSection: true,
          });
        }
      }
    }
    
    // If still nothing, check all lines but filter small amounts
    if (amountCandidates.length === 0) {
      for (const match of allMatches) {
        const amount = parseFloat(match[1]);
        if (!isNaN(amount) && amount > 0 && amount < 1000000 && amount >= 1) {
          amountCandidates.push({
            amount,
            line: normalizedText.substring(Math.max(0, match.index! - 30), match.index! + 30),
            priority: 1,
            keyword: "any amount",
            lineIndex: 0,
            isBottomSection: false,
          });
        }
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
    // Check for total patterns (more flexible)
    if (/total|grand\s*total|final\s*total|amount\s*total/i.test(line)) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match) {
        const amount = parseFloat(match[1]);
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          results.push({ amount, line, keyword: "Total" });
        }
      }
    }

    // Check for amount due
    if (/amount\s*due|balance\s*due|due\s*amount/i.test(line)) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match) {
        const amount = parseFloat(match[1]);
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          results.push({ amount, line, keyword: "Amount Due" });
        }
      }
    }

    // Check for credit card amounts
    if (/(?:visa|mastercard|amex|discover|card|payment)/i.test(line)) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match) {
        const amount = parseFloat(match[1]);
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          results.push({ amount, line, keyword: "Card Payment" });
        }
      }
    }

    // Check for subtotal patterns and look for corresponding total
    if (/sub\s*total|subtotal/i.test(line)) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match) {
        const subtotal = parseFloat(match[1]);
        // Look for amounts larger than subtotal (likely the total)
        for (const otherLine of lines) {
          const totalMatch = otherLine.match(/(\d+\.\d{2})/);
          if (totalMatch) {
            const amount = parseFloat(totalMatch[1]);
            if (!isNaN(amount) && amount > subtotal && amount < 1000000) {
              if (/total|due|paid/i.test(otherLine)) {
                results.push({ amount, line: otherLine, keyword: "Total (after subtotal)" });
              }
            }
          }
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

