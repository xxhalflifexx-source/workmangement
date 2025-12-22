/**
 * Utility functions for extracting amounts from receipt text using OCR
 */

import { ReceiptFormat } from "./receipt-formats";
import { applyLearnedPatterns } from "./receipt-learning";

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
 * @param text - OCR text from receipt
 * @param format - Optional receipt format to use format-specific extraction rules
 */
export function extractAmountFromText(text: string, format?: ReceiptFormat | null): number | null {
  if (!text) return null;

  // Preserve line structure for better analysis
  const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);
  const normalizedText = text.replace(/\s+/g, " ").trim();

  // Helper function to extract amount from various formats (defined early for use throughout)
  function extractAmountFromString(str: string): number | null {
    // Try standard format: $XX.XX or XX.XX
    let match = str.match(/\$?\s*(\d+\.\d{2})/);
    if (match) return parseFloat(match[1]);
    
    // Try comma decimal: XX,XX (European format)
    match = str.match(/\$?\s*(\d+,\d{2})/);
    if (match) return parseFloat(match[1].replace(',', '.'));
    
    // Try space decimal: XX XX (some formats)
    match = str.match(/\$?\s*(\d+)\s+(\d{2})/);
    if (match) return parseFloat(`${match[1]}.${match[2]}`);
    
    return null;
  }

  // Helper function to extract all amounts from lines (for validation)
  function extractAllAmountsFromLines(lineArray: string[]): number[] {
    const amounts: number[] = [];
    for (const line of lineArray) {
      const matches = Array.from(line.matchAll(/(\d+[.,]\d{2}|\d+\s+\d{2})/g));
      for (const match of matches) {
        const amount = extractAmountFromString(match[0]);
        if (amount !== null && amount > 0 && amount < 100000) {
          amounts.push(amount);
        }
      }
    }
    return amounts;
  }

  // Get learned patterns to boost confidence
  const learnedHints = applyLearnedPatterns(text, format?.storeName, format?.id);

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
  
  // Use format-specific bottom threshold if format provided, otherwise use default logic
  let bottomThreshold: number;
  let filterTopPercent: number;
  
  if (format) {
    // Use format-specific rules
    bottomThreshold = Math.floor(totalLines * (1 - format.extractionRules.preferBottomPercent / 100));
    filterTopPercent = format.extractionRules.filterTopPercent;
  } else {
    // Default logic: For full receipts (>20 lines), be more aggressive - only consider bottom 20%
    // For shorter receipts, use bottom 30%
    bottomThreshold = totalLines > 20 
      ? Math.floor(totalLines * 0.8)  // Bottom 20% for long receipts
      : Math.floor(totalLines * 0.7); // Bottom 30% for shorter receipts
    filterTopPercent = 50; // Default: filter top 50%
  }

  // Create a map of learned patterns for quick lookup
  // VALIDATION: Only include learned patterns that match actual amounts in the receipt
  const learnedPatternMap = new Map<string, number>();
  const allReceiptAmounts = extractAllAmountsFromLines(lines); // Get all amounts in receipt for validation
  
  for (const hint of learnedHints) {
    // Only add learned pattern if it's actually relevant to this receipt
    // (Pattern must match a line that contains a valid amount)
    let patternMatchesReceipt = false;
    for (const line of lines) {
      const linePattern = line.replace(/\d+\.\d{2}/g, "AMOUNT").replace(/\d+/g, "NUM").replace(/\s+/g, " ").trim().toUpperCase();
      if (linePattern === hint.pattern) {
        // Check if this line contains a valid amount
        const amountMatch = line.match(/(\d+\.\d{2})/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1]);
          // Validate amount is in the receipt and reasonable
          if (amount > 0 && amount < 100000) {
            patternMatchesReceipt = true;
            break;
          }
        }
      }
    }
    
    if (patternMatchesReceipt) {
      learnedPatternMap.set(hint.pattern, hint.priority);
    }
  }


  // PRIORITY -1: ULTRA-PRIORITY - Look for "total" with amount DIRECTLY to the right (0-10 chars away)
  // 95% of receipts have amount immediately right of "total" - check ALL lines first
  // Expanded keyword variations: TOTAL, Total, TOTAL DUE, AMOUNT DUE, BALANCE, GRAND TOTAL, Tot:, Tot., Ttl, TOT
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for "total" keyword variations (case insensitive, more variations)
    const totalMatch = line.match(/\b(total|grand\s*total|final\s*total|amount\s*total|total\s*due|amount\s*due|balance\s*due|balance|tot[:.]|ttl)\b/i);
    if (totalMatch && totalMatch.index !== undefined) {
      const totalIndex = totalMatch.index;
      const afterTotal = line.substring(totalIndex + totalMatch[0].length);
      
      // Pattern 1: "Total $XX.XX" or "Total: $XX.XX" - amount immediately after total (0-10 chars)
      // Handle multiple amount formats
      const immediateMatch = afterTotal.match(/^[:\s]*\$?\s*(\d+[.,]\d{2}|\d+\s+\d{2})/);
      if (immediateMatch) {
        const amount = extractAmountFromString(immediateMatch[0]);
        if (amount !== null) {
          const minAmount = format ? format.extractionRules.minAmount : 0;
          const maxAmount = format ? format.extractionRules.maxAmount : 1000000;
          
          if (amount > minAmount && amount < maxAmount) {
            // Found amount DIRECTLY right of total - return immediately!
            return amount;
          }
        }
      }
      
      // Pattern 2: Amount within 10 characters of "total" (check for spacing/padding)
      const nearbyMatch = afterTotal.substring(0, 15).match(/(\d+[.,]\d{2}|\d+\s+\d{2})/);
      if (nearbyMatch) {
        const distance = nearbyMatch.index || 0;
        // Only accept if amount is within 10 characters (allowing for spacing, colons, etc.)
        if (distance <= 10) {
          const amount = extractAmountFromString(nearbyMatch[0]);
          if (amount !== null) {
            const minAmount = format ? format.extractionRules.minAmount : 0;
            const maxAmount = format ? format.extractionRules.maxAmount : 1000000;
            
            if (amount > minAmount && amount < maxAmount) {
              // Found amount very close to total - return immediately!
              return amount;
            }
          }
        }
      }
    }
  }

  // PRIORITY 0: FIRST PASS - Look ONLY in bottom section for "TOTAL" keyword
  // If found, use it immediately (most reliable indicator)
  for (let i = bottomThreshold; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for "total" keyword variations (expanded list)
    const totalKeywordMatch = line.match(/\b(total|grand\s*total|final\s*total|amount\s*total|total\s*due|amount\s*due|balance\s*due|balance|tot[:.]|ttl)\b/i);
    if (totalKeywordMatch) {
      // Pattern 1: "Total $XX.XX" or "Total: $XX.XX" or "Total XX.XX"
      const pattern1 = line.match(/\btotal\b[:\s]*\$?\s*(\d+\.\d{2})/i);
      if (pattern1) {
        const amount = parseFloat(pattern1[1]);
        const minAmount = format ? format.extractionRules.minAmount : 0;
        const maxAmount = format ? format.extractionRules.maxAmount : 1000000;
        
        if (!isNaN(amount) && amount > minAmount && amount < maxAmount) {
          // Found TOTAL in bottom section - return immediately!
          return amount;
        }
      }
      
      // Pattern 2: Amount at end of line after "total" keyword
      const endMatch = line.match(/\btotal\b.*?(\d+\.\d{2})\s*$/i);
      if (endMatch) {
        const amount = parseFloat(endMatch[1]);
        const minAmount = format ? format.extractionRules.minAmount : 0;
        const maxAmount = format ? format.extractionRules.maxAmount : 1000000;
        
        if (!isNaN(amount) && amount > minAmount && amount < maxAmount) {
          // Found TOTAL in bottom section - return immediately!
          return amount;
        }
      }
    }
  }

  // Priority 1: Lines containing "Total" - Extract amount next to "total" keyword
  // This is the most reliable method - find "total" and get the amount near it
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBottomSection = i >= bottomThreshold;
    
    // Look for "total" keyword variations (expanded list)
    const totalKeywordMatch = line.match(/\b(total|grand\s*total|final\s*total|amount\s*total|total\s*due|amount\s*due|balance\s*due|balance|tot[:.]|ttl)\b/i);
    if (totalKeywordMatch) {
      // Try multiple patterns to find amount next to "total"
      
      // Pattern 1: "Total $XX.XX" or "Total: $XX.XX" or "Total XX.XX" - AMOUNT DIRECTLY RIGHT OF TOTAL
      // This is the 95% case - highest priority!
      // Handle multiple amount formats: $XX.XX, XX.XX, XX,XX, XX XX
      const pattern1Match = line.match(/\b(total|grand\s*total|final\s*total|amount\s*total|total\s*due|amount\s*due|balance\s*due|balance|tot[:.]|ttl)\b[:\s]*\$?\s*(\d+[.,]\d{2}|\d+\s+\d{2})/i);
      if (pattern1Match) {
        const amountStr = pattern1Match[2] || pattern1Match[0].substring(pattern1Match.index! + pattern1Match[0].indexOf(pattern1Match[2] || ''));
        const amount = extractAmountFromString(amountStr);
        if (amount !== null) {
          const minAmount = format ? format.extractionRules.minAmount : 0;
          const maxAmount = format ? format.extractionRules.maxAmount : 1000000;
          
          if (amount > minAmount && amount < maxAmount) {
            // Check if this line matches a learned pattern
            const normalizedLine = line.replace(/\d+[.,]\d{2}/g, "AMOUNT").replace(/\d+/g, "NUM").replace(/\s+/g, " ").trim().toUpperCase();
            const learnedBoost = learnedPatternMap.get(normalizedLine) || 0;
            
            // ULTRA HIGH PRIORITY: Amount directly right of total (95% case)
            // Priority: 35+ for bottom section, 28+ for other sections
            amountCandidates.push({
              amount,
              line,
              priority: (isBottomSection ? 35 : 28) + learnedBoost, // HIGHEST priority - amount directly right of total
              keyword: "total",
              lineIndex: i,
              isBottomSection,
            });
          }
        }
      }
      
      // Pattern 2: Amount at end of line after "total" keyword (lower priority than Pattern 1)
      // "Total                   20.53" or "Total 20.53"
      // Handle multiple formats
      const endMatch = line.match(/\b(total|grand\s*total|final\s*total|amount\s*total|total\s*due|amount\s*due|balance\s*due|balance|tot[:.]|ttl)\b.*?(\d+[.,]\d{2}|\d+\s+\d{2})\s*$/i);
      if (endMatch) {
        const amountStr = endMatch[2];
        const amount = extractAmountFromString(amountStr);
        if (amount !== null) {
          const minAmount = format ? format.extractionRules.minAmount : 0;
          const maxAmount = format ? format.extractionRules.maxAmount : 1000000;
          
          if (amount > minAmount && amount < maxAmount) {
            // Check if this line matches a learned pattern
            const normalizedLine = line.replace(/\d+[.,]\d{2}/g, "AMOUNT").replace(/\d+/g, "NUM").replace(/\s+/g, " ").trim().toUpperCase();
            const learnedBoost = learnedPatternMap.get(normalizedLine) || 0;
            
            // Lower priority than Pattern 1 (amount is further from total)
            amountCandidates.push({
              amount,
              line,
              priority: (isBottomSection ? 22 : 15) + learnedBoost, // Lower priority - amount at end of line
              keyword: "total",
              lineIndex: i,
              isBottomSection,
            });
          }
        }
      }
      
      // Pattern 3: Amount anywhere on the line with "total" (fallback - lowest priority)
      // Extract all amounts from the line and prefer the largest reasonable one
      // Handle multiple amount formats
      const allAmountsOnLine = Array.from(line.matchAll(/(\d+[.,]\d{2}|\d+\s+\d{2})/g));
      for (const match of allAmountsOnLine) {
        const amount = extractAmountFromString(match[0]);
        if (amount === null) continue;
        
        const minAmount = format ? format.extractionRules.minAmount : 1;
        const maxAmount = format ? format.extractionRules.maxAmount : 1000000;
        
        // Prefer amounts that are reasonable (not too small, not too large)
        if (amount >= minAmount && amount < maxAmount) {
          // Check if amount is near any "total" keyword (within 30 chars)
          const totalKeywords = ['total', 'grand total', 'final total', 'amount total', 'total due', 'amount due', 'balance due', 'balance', 'tot:', 'tot.', 'ttl'];
          let minDistance = Infinity;
          for (const keyword of totalKeywords) {
            const keywordIndex = line.toLowerCase().indexOf(keyword);
            if (keywordIndex >= 0) {
              const amountIndex = match.index || 0;
              const distance = Math.abs(amountIndex - keywordIndex);
              minDistance = Math.min(minDistance, distance);
            }
          }
          
          if (minDistance < 30) {
            // Check if this line matches a learned pattern
            const normalizedLine = line.replace(/\d+[.,]\d{2}/g, "AMOUNT").replace(/\d+/g, "NUM").replace(/\s+/g, " ").trim().toUpperCase();
            const learnedBoost = learnedPatternMap.get(normalizedLine) || 0;
            
            // LOWEST priority - amount is somewhere on line but not directly right of total
            amountCandidates.push({
              amount,
              line,
              priority: (isBottomSection ? 18 : 10) + learnedBoost, // Lower priority - amount not directly right of total
              keyword: "total",
              lineIndex: i,
              isBottomSection,
            });
          }
        }
      }
    }
  }

  // Priority 2: Lines containing "Amount Due" or "Balance Due" or "Due"
  // Prioritize bottom section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBottomSection = i >= bottomThreshold;
    // Handle multiple formats: "Amount Due: $XX.XX", "Balance Due $XX.XX", "Due: XX.XX"
    const dueMatch = line.match(/(?:amount\s*due|balance\s*due|due)[:\s]*\$?\s*(\d+[.,]\d{2}|\d+\s+\d{2})/i);
    if (dueMatch) {
      const amount = extractAmountFromString(dueMatch[1] || dueMatch[0]);
      if (amount !== null && amount > 0 && amount < 1000000) {
        const minAmount = format ? format.extractionRules.minAmount : 0;
        const maxAmount = format ? format.extractionRules.maxAmount : 1000000;
        if (amount > minAmount && amount < maxAmount) {
          amountCandidates.push({
            amount,
            line,
            priority: isBottomSection ? 20 : 9, // Higher priority for bottom section
            keyword: "amount due",
            lineIndex: i,
            isBottomSection,
          });
        }
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
  // Use format-specific filter percentage if available
  const topFilterThreshold = Math.floor(totalLines * (filterTopPercent / 100));
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBottomSection = i >= bottomThreshold;
    const isTopFiltered = i < topFilterThreshold;
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
        
        // Filter out amounts in top section (likely item prices)
        // Use format-specific filter or default logic
        if (isTopFiltered && !hasKeyword && !isBottomSection) {
          // Apply format-specific min amount if available
          const minAmount = format ? format.extractionRules.minAmount : 1;
          if (amount < minAmount) {
            continue;
          }
          // For full receipts or when format specifies, filter more aggressively
          if (totalLines > 20 || (format && filterTopPercent > 50)) {
            continue;
          }
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

  // DEBUG: Log all candidates found
  if (amountCandidates.length > 0) {
    console.log(`[ReceiptOCR] Found ${amountCandidates.length} amount candidates:`, 
      amountCandidates.map(c => ({
        amount: c.amount,
        priority: c.priority,
        keyword: c.keyword,
        line: c.line.substring(0, 50),
        isBottom: c.isBottomSection
      }))
    );
  }

  if (amountCandidates.length === 0) {
    console.log("[ReceiptOCR] No candidates found, trying fallback strategies...");
    console.log("[ReceiptOCR] Total lines:", totalLines, "Bottom threshold:", bottomThreshold);
    
    // FALLBACK STRATEGY 1: Try to find largest amount in bottom 30% of receipt
    const bottomLines = lines.slice(bottomThreshold);
    console.log("[ReceiptOCR] Checking bottom", bottomLines.length, "lines");
    const bottomAmounts: number[] = [];
    for (const line of bottomLines) {
      const matches = Array.from(line.matchAll(/(\d+[.,]\d{2}|\d+\s+\d{2})/g));
      for (const match of matches) {
        const amount = extractAmountFromString(match[0]);
        if (amount !== null && amount >= 1 && amount < 100000) {
          bottomAmounts.push(amount);
          console.log("[ReceiptOCR] Found amount in bottom section:", amount, "from line:", line.substring(0, 60));
        }
      }
    }
    if (bottomAmounts.length > 0) {
      const maxAmount = Math.max(...bottomAmounts);
      console.log("[ReceiptOCR] Fallback 1 success: returning", maxAmount, "from bottom section");
      return maxAmount;
    }
    
    // FALLBACK STRATEGY 2: Try last line (often contains total)
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const lastLineMatches = Array.from(lastLine.matchAll(/(\d+[.,]\d{2}|\d+\s+\d{2})/g));
      if (lastLineMatches.length > 0) {
        const amounts = lastLineMatches.map(m => extractAmountFromString(m[0])).filter(a => a !== null && a >= 1) as number[];
        if (amounts.length > 0) {
          return Math.max(...amounts);
        }
      }
    }
    
    // FALLBACK STRATEGY 3: Calculate total from subtotal + tax
    let foundSubtotal: number | null = null;
    let foundTax: number | null = null;
    for (const line of lines) {
      const subtotalMatch = line.match(/\b(subtotal|sub\s*total)[:\s]*\$?\s*(\d+[.,]\d{2}|\d+\s+\d{2})/i);
      if (subtotalMatch && !foundSubtotal) {
        foundSubtotal = extractAmountFromString(subtotalMatch[2] || subtotalMatch[0]);
      }
      const taxMatch = line.match(/\b(tax|sales\s*tax)[:\s]*\$?\s*(\d+[.,]\d{2}|\d+\s+\d{2})/i);
      if (taxMatch && !foundTax) {
        foundTax = extractAmountFromString(taxMatch[2] || taxMatch[0]);
      }
    }
    if (foundSubtotal !== null && foundTax !== null) {
      const calculatedTotal = foundSubtotal + foundTax;
      if (calculatedTotal > 0 && calculatedTotal < 100000) {
        console.log("[ReceiptOCR] Fallback 3 success: calculated total", calculatedTotal, "from subtotal", foundSubtotal, "+ tax", foundTax);
        return calculatedTotal;
      }
    }
    
    // FALLBACK STRATEGY 4: Last resort - find ANY amount in last 3 lines (often the total)
    console.log("[ReceiptOCR] Fallback 4: Checking last 3 lines for any amount");
    const last3Lines = lines.slice(Math.max(0, lines.length - 3));
    const last3Amounts: number[] = [];
    for (const line of last3Lines) {
      const matches = Array.from(line.matchAll(/(\d+[.,]\d{2}|\d+\s+\d{2})/g));
      for (const match of matches) {
        const amount = extractAmountFromString(match[0]);
        if (amount !== null && amount >= 1 && amount < 100000) {
          last3Amounts.push(amount);
          console.log("[ReceiptOCR] Found amount in last 3 lines:", amount, "from:", line.substring(0, 60));
        }
      }
    }
    if (last3Amounts.length > 0) {
      // Prefer largest amount from last 3 lines
      const maxAmount = Math.max(...last3Amounts);
      console.log("[ReceiptOCR] Fallback 4 success: returning", maxAmount, "from last 3 lines");
      return maxAmount;
    }
    
    console.log("[ReceiptOCR] All fallback strategies failed - no amount found");
    return null;
  }

  // VALIDATION: Find subtotal to validate total is >= subtotal
  let subtotal: number | null = null;
  for (const line of lines) {
    const subtotalMatch = line.match(/\b(subtotal|sub\s*total)[:\s]*\$?\s*(\d+[.,]\d{2}|\d+\s+\d{2})/i);
    if (subtotalMatch) {
      const subAmount = extractAmountFromString(subtotalMatch[2] || subtotalMatch[0]);
      if (subAmount !== null && subAmount > 0) {
        subtotal = subAmount;
        break;
      }
    }
  }

  // VALIDATION: Filter out invalid amounts
  const validCandidates = amountCandidates.filter(candidate => {
    // Reject amounts that are too small (< $1) unless clearly marked as total
    if (candidate.amount < 1 && candidate.keyword !== "total" && !candidate.isBottomSection) {
      console.log(`[ReceiptOCR] Rejected candidate ${candidate.amount}: too small (< $1) and not marked as total`);
      return false;
    }
    
    // Reject amounts that are less than subtotal (unless subtotal is very small or it's high priority)
    if (subtotal !== null && candidate.amount < subtotal && subtotal > 1) {
      // Allow if it's a very high-priority match (might be correct despite being less)
      if (candidate.priority < 25) {
        console.log(`[ReceiptOCR] Rejected candidate ${candidate.amount}: less than subtotal ${subtotal} and priority ${candidate.priority} < 25`);
        return false;
      }
    }
    
    // Reject unreasonable amounts
    if (candidate.amount <= 0 || candidate.amount > 100000) {
      console.log(`[ReceiptOCR] Rejected candidate ${candidate.amount}: unreasonable amount`);
      return false;
    }
    
    return true;
  });
  
  console.log(`[ReceiptOCR] After validation: ${validCandidates.length} valid candidates out of ${amountCandidates.length} total`);

  // If no valid candidates after filtering, use original candidates (fallback)
  const candidatesToUse = validCandidates.length > 0 ? validCandidates : amountCandidates;

  // Sort by priority (highest first), then by amount (largest first)
  candidatesToUse.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    // If same priority, prefer larger amounts (likely total vs subtotal)
    return b.amount - a.amount;
  });

  // Check for duplicate amounts (if same amount appears multiple times, it's likely the total)
  const amountCounts = new Map<number, number>();
  candidatesToUse.forEach(c => {
    amountCounts.set(c.amount, (amountCounts.get(c.amount) || 0) + 1);
  });

  // If an amount appears multiple times and has high priority, prefer it
  const duplicateAmounts = Array.from(amountCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([amount]) => amount);

  if (duplicateAmounts.length > 0) {
    // Find the highest priority duplicate amount
    for (const candidate of candidatesToUse) {
      if (duplicateAmounts.includes(candidate.amount) && candidate.priority >= 5) {
        return candidate.amount;
      }
    }
  }

  // Return the highest priority amount
  const finalAmount = candidatesToUse[0].amount;
  console.log(`[ReceiptOCR] Selected final amount: ${finalAmount} (priority: ${candidatesToUse[0].priority}, keyword: ${candidatesToUse[0].keyword})`);
  return finalAmount;
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

