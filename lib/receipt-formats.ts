/**
 * Receipt format library for common stores
 * Contains format definitions, detection logic, and extraction rules
 */

export interface ReceiptFormat {
  id: string;
  storeName: string;
  category: string; // "auto-parts", "metal-supply", "hardware", etc.
  aliases?: string[]; // Alternative store name variations
  patterns: {
    totalKeywords: string[]; // ["TOTAL", "AMOUNT DUE", etc.]
    totalLocation: "bottom" | "middle" | "top";
    totalLinePattern?: RegExp;
    commonSections: string[]; // ["SUBTOTAL", "TAX", "TOTAL"]
    storeNamePattern?: RegExp; // Pattern to detect store name
  };
  extractionRules: {
    preferBottomPercent: number; // 30, 40, 50
    filterTopPercent: number; // Filter amounts from top X%
    minAmount: number; // Minimum expected total
    maxAmount: number; // Maximum expected total
  };
  examples?: string[]; // Sample OCR text for testing
}

/**
 * Receipt format library
 */
export const RECEIPT_FORMATS: ReceiptFormat[] = [
  // Auto Parts Stores
  {
    id: "oreilly-auto-parts",
    storeName: "O'Reilly Auto Parts",
    category: "auto-parts",
    aliases: ["OREILLY", "OREILLYS", "O'REILLY", "O'REILLYS"],
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT DUE", "BALANCE", "AMOUNT"],
      totalLocation: "bottom",
      totalLinePattern: /TOTAL\s+\$?(\d+\.\d{2})/i,
      commonSections: ["SUBTOTAL", "TAX", "TOTAL"],
      storeNamePattern: /O['']?REILLY/i,
    },
    extractionRules: {
      preferBottomPercent: 30,
      filterTopPercent: 60,
      minAmount: 5,
      maxAmount: 10000,
    },
  },
  {
    id: "autozone",
    storeName: "AutoZone",
    category: "auto-parts",
    aliases: ["AUTOZONE", "AUTO ZONE"],
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT DUE", "BALANCE"],
      totalLocation: "bottom",
      totalLinePattern: /TOTAL\s+\$?(\d+\.\d{2})/i,
      commonSections: ["SUBTOTAL", "TAX", "TOTAL"],
      storeNamePattern: /AUTOZONE/i,
    },
    extractionRules: {
      preferBottomPercent: 30,
      filterTopPercent: 60,
      minAmount: 5,
      maxAmount: 10000,
    },
  },
  {
    id: "napa-auto-parts",
    storeName: "NAPA Auto Parts",
    category: "auto-parts",
    aliases: ["NAPA", "NAPA AUTO"],
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT DUE", "BALANCE"],
      totalLocation: "bottom",
      totalLinePattern: /TOTAL\s+\$?(\d+\.\d{2})/i,
      commonSections: ["SUBTOTAL", "TAX", "TOTAL"],
      storeNamePattern: /NAPA/i,
    },
    extractionRules: {
      preferBottomPercent: 30,
      filterTopPercent: 60,
      minAmount: 5,
      maxAmount: 10000,
    },
  },

  // Metal Suppliers
  {
    id: "metal-supplier-generic",
    storeName: "Metal Supplier",
    category: "metal-supply",
    // Narrowed aliases - require more specific patterns, not just single words
    aliases: ["METAL SUPPLY", "METAL SUPPLIER", "STEEL COMPANY", "STEEL SUPPLY", "ALUMINUM SUPPLY"],
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT", "DUE", "BALANCE DUE"],
      totalLocation: "bottom",
      totalLinePattern: /(?:TOTAL|AMOUNT|BALANCE\s*DUE)\s*:?\s*\$?(\d+\.\d{2})/i,
      commonSections: ["SUBTOTAL", "TAX", "SHIPPING", "TOTAL", "BALANCE DUE"],
      // More specific pattern - require "METAL" or "STEEL" with "SUPPLY" or "COMPANY"
      storeNamePattern: /(?:METAL|STEEL|ALUMINUM)\s+(?:SUPPLY|SUPPLIER|COMPANY)/i,
    },
    extractionRules: {
      preferBottomPercent: 40,
      filterTopPercent: 50,
      minAmount: 10,
      maxAmount: 50000,
    },
  },

  // Hardware Stores
  {
    id: "home-depot",
    storeName: "Home Depot",
    category: "hardware",
    aliases: ["HOME DEPOT", "HOMEDEPOT"],
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT DUE", "BALANCE"],
      totalLocation: "bottom",
      totalLinePattern: /TOTAL\s+\$?(\d+\.\d{2})/i,
      commonSections: ["SUBTOTAL", "TAX", "TOTAL"],
      storeNamePattern: /HOME\s*DEPOT/i,
    },
    extractionRules: {
      preferBottomPercent: 30,
      filterTopPercent: 60,
      minAmount: 1,
      maxAmount: 50000,
    },
  },
  {
    id: "lowes",
    storeName: "Lowe's",
    category: "hardware",
    aliases: ["LOWES", "LOWE'S"],
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT DUE", "BALANCE"],
      totalLocation: "bottom",
      totalLinePattern: /TOTAL\s+\$?(\d+\.\d{2})/i,
      commonSections: ["SUBTOTAL", "TAX", "TOTAL"],
      storeNamePattern: /LOWE['']?S/i,
    },
    extractionRules: {
      preferBottomPercent: 30,
      filterTopPercent: 60,
      minAmount: 1,
      maxAmount: 50000,
    },
  },

  // Gas Stations
  {
    id: "gas-station-generic",
    storeName: "Gas Station",
    category: "gas-station",
    aliases: ["GAS", "FUEL", "SHELL", "EXXON", "BP", "CHEVRON"],
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT", "FUEL TOTAL"],
      totalLocation: "bottom",
      totalLinePattern: /(?:TOTAL|FUEL\s*TOTAL)\s+\$?(\d+\.\d{2})/i,
      commonSections: ["FUEL", "TOTAL"],
    },
    extractionRules: {
      preferBottomPercent: 40,
      filterTopPercent: 50,
      minAmount: 5,
      maxAmount: 500,
    },
  },

  // Restaurants
  {
    id: "restaurant-generic",
    storeName: "Restaurant",
    category: "restaurant",
    aliases: ["RESTAURANT", "DINER", "CAFE"],
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT DUE", "GRAND TOTAL", "BILL TOTAL"],
      totalLocation: "bottom",
      totalLinePattern: /(?:TOTAL|GRAND\s*TOTAL|BILL\s*TOTAL)\s+\$?(\d+\.\d{2})/i,
      commonSections: ["SUBTOTAL", "TAX", "TIP", "TOTAL"],
    },
    extractionRules: {
      preferBottomPercent: 30,
      filterTopPercent: 60,
      minAmount: 5,
      maxAmount: 1000,
    },
  },

  // Retail Stores (Generic)
  {
    id: "retail-generic",
    storeName: "Retail Store",
    category: "retail",
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT DUE", "BALANCE"],
      totalLocation: "bottom",
      totalLinePattern: /TOTAL\s+\$?(\d+\.\d{2})/i,
      commonSections: ["SUBTOTAL", "TAX", "TOTAL"],
    },
    extractionRules: {
      preferBottomPercent: 30,
      filterTopPercent: 60,
      minAmount: 1,
      maxAmount: 10000,
    },
  },

  // Invoices / B2B Receipts
  {
    id: "invoice-generic",
    storeName: "Invoice",
    category: "invoice",
    aliases: ["INVOICE", "BILL", "STATEMENT"],
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT DUE", "BALANCE DUE", "DUE"],
      totalLocation: "bottom",
      totalLinePattern: /(?:TOTAL|AMOUNT\s*DUE|BALANCE\s*DUE|DUE)[:\s]*\$?(\d+\.\d{2})/i,
      commonSections: ["SUBTOTAL", "TAX", "SHIPPING", "TOTAL", "AMOUNT DUE"],
    },
    extractionRules: {
      preferBottomPercent: 30,
      filterTopPercent: 50,
      minAmount: 1,
      maxAmount: 100000,
    },
  },

  // Generic Receipt (catch-all for any receipt with "TOTAL")
  {
    id: "generic-receipt",
    storeName: "Receipt",
    category: "generic",
    patterns: {
      totalKeywords: ["TOTAL", "AMOUNT", "DUE"],
      totalLocation: "bottom",
      totalLinePattern: /TOTAL[:\s]*\$?(\d+\.\d{2})/i,
      commonSections: ["TOTAL"],
    },
    extractionRules: {
      preferBottomPercent: 30,
      filterTopPercent: 50,
      minAmount: 0.01,
      maxAmount: 100000,
    },
  },
];

/**
 * Detect receipt format from OCR text
 * Returns the best matching format or null if no match
 */
export function detectReceiptFormat(ocrText: string): ReceiptFormat | null {
  if (!ocrText || ocrText.trim().length === 0) {
    return null;
  }

  const normalized = ocrText.toUpperCase();
  let bestMatch: ReceiptFormat | null = null;
  let bestScore = 0;

  // Check each format
  for (const format of RECEIPT_FORMATS) {
    let score = 0;

    // Check store name pattern (highest priority)
    if (format.patterns.storeNamePattern) {
      if (format.patterns.storeNamePattern.test(ocrText)) {
        score += 100; // Strong match
      }
    }

    // Check store name and aliases
    const storeNameUpper = format.storeName.toUpperCase();
    if (normalized.includes(storeNameUpper)) {
      score += 50;
    }

    if (format.aliases) {
      for (const alias of format.aliases) {
        if (normalized.includes(alias.toUpperCase())) {
          score += 40;
          break;
        }
      }
    }

    // Check for format-specific keywords
    for (const keyword of format.patterns.totalKeywords) {
      if (normalized.includes(keyword.toUpperCase())) {
        score += 10;
      }
    }

    // Check for common sections
    for (const section of format.patterns.commonSections) {
      if (normalized.includes(section.toUpperCase())) {
        score += 5;
      }
    }

    // Check total line pattern (higher weight if matches)
    if (format.patterns.totalLinePattern) {
      if (format.patterns.totalLinePattern.test(ocrText)) {
        score += 30;
      }
    }
    
    // Boost score if format has specific store name pattern and it matches
    if (format.patterns.storeNamePattern && format.patterns.storeNamePattern.test(ocrText)) {
      score += 20; // Additional boost for store name pattern match
    }

    // Update best match
    if (score > bestScore) {
      bestScore = score;
      bestMatch = format;
    }
  }

  // Lower threshold to 40 points to catch more formats (was 50)
  // This helps with generic receipts that don't match specific stores
  return bestScore >= 40 ? bestMatch : null;
}

/**
 * Extract vendor name from receipt OCR text
 * Looks for company names in the top section of the receipt
 * @param ocrText - Full OCR text from receipt
 * @returns Extracted vendor name or null if not found
 */
export function extractVendorName(ocrText: string): string | null {
  if (!ocrText || ocrText.trim().length === 0) {
    return null;
  }

  const lines = ocrText.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) {
    return null;
  }

  // Look in top 20% of receipt (header section)
  const headerLines = Math.max(1, Math.floor(lines.length * 0.2));
  const headerSection = lines.slice(0, headerLines);

  // Common words to filter out (not company names)
  const filterWords = new Set([
    "RECEIPT", "INVOICE", "ORDER", "DATE", "TIME", "CASHIER", "REGISTER",
    "THANK", "YOU", "VISIT", "AGAIN", "STORE", "NUMBER", "PHONE", "ADDRESS",
    "TEL", "FAX", "EMAIL", "WEB", "WWW", "HTTP", "HTTPS", "COM", "NET", "ORG",
    "CARD", "PAYMENT", "METHOD", "TOTAL", "SUBTOTAL", "TAX", "AMOUNT", "DUE",
    "BALANCE", "CHANGE", "CASH", "CREDIT", "DEBIT", "REFUND", "RETURN",
    "ITEM", "QTY", "QUANTITY", "PRICE", "EACH", "DISCOUNT", "COUPON",
    "SALE", "SPECIAL", "PROMOTION", "OFFER", "VALID", "EXPIRES", "EXP",
    "FROM", "TO", "BETWEEN", "AND", "OR", "THE", "A", "AN", "OF", "IN", "ON",
    "AT", "BY", "FOR", "WITH", "IS", "ARE", "WAS", "WERE", "BE", "BEEN",
    "HAVE", "HAS", "HAD", "DO", "DOES", "DID", "WILL", "WOULD", "SHOULD",
    "COULD", "MAY", "MIGHT", "MUST", "CAN", "CANNOT", "NO", "NOT", "YES",
    "PLEASE", "CALL", "CONTACT", "INFO", "INFORMATION", "CUSTOMER", "SERVICE",
    "SUPPORT", "HELP", "QUESTIONS", "CONCERNS", "COMPLAINTS", "FEEDBACK",
    "REVIEW", "RATING", "STARS", "LIKE", "SHARE", "FOLLOW", "SUBSCRIBE",
    "NEWSLETTER", "SIGN", "UP", "JOIN", "MEMBER", "MEMBERSHIP", "ACCOUNT",
    "LOGIN", "LOGOUT", "PASSWORD", "USERNAME", "EMAIL", "ADDRESS", "ZIP",
    "CODE", "POSTAL", "STATE", "CITY", "STREET", "AVENUE", "ROAD", "DRIVE",
    "LANE", "BOULEVARD", "BLVD", "AVE", "ST", "RD", "DR", "LN", "CT", "CIRCLE",
    "CIR", "PLACE", "PL", "PARKWAY", "PKWY", "WAY", "TRAIL", "TRL", "COURT",
    "COURT", "SQUARE", "SQ", "TERRACE", "TER", "PARK", "PASS", "PASSAGE",
    "PASSAGE", "PROMENADE", "PROM", "QUAY", "QUAY", "RIDGE", "RIDGE", "RISE",
    "RISE", "ROUNDABOUT", "RABOUT", "ROW", "ROW", "RUN", "RUN", "SENTINEL",
    "SENTINEL", "SPUR", "SPUR", "STRAIGHT", "STRAIGHT", "STRAND", "STRAND",
    "STREAM", "STREAM", "STRIP", "STRIP", "SUBDIVISION", "SUBDIV", "SUMMIT",
    "SUMMIT", "TARN", "TARN", "TERRACE", "TER", "THOROUGHFARE", "THOROUGH",
    "THOROUGH", "TRACK", "TRACK", "TRAIL", "TRL", "TURN", "TURN", "TURNPIKE",
    "TURNPIKE", "UNDERPASS", "UNDERPASS", "VALE", "VALE", "VALLEY", "VALLEY",
    "VIADUCT", "VIADUCT", "VIEW", "VIEW", "VILLAGE", "VILLAGE", "VILLAS",
    "VILLAS", "VISTA", "VISTA", "WALK", "WALK", "WALKWAY", "WALKWAY", "WAY",
    "WAY", "WHARF", "WHARF", "WOOD", "WOOD", "WYND", "WYND", "YARD", "YARD",
  ]);

  // Look for substantial lines (2+ words, not just numbers/symbols)
  for (const line of headerSection) {
    // Skip lines that are mostly numbers, dates, or symbols
    if (/^[\d\s\-\/\.\:]+$/.test(line)) {
      continue;
    }

    // Skip lines that are too short (less than 3 characters)
    if (line.length < 3) {
      continue;
    }

    // Skip lines that are mostly common filter words
    const words = line.split(/\s+/).filter(w => w.length > 0);
    const filteredWords = words.filter(w => !filterWords.has(w.toUpperCase()));
    
    // Need at least 2 non-filter words to be considered a company name
    if (filteredWords.length >= 2) {
      // Clean up the line - remove extra spaces, keep original capitalization
      const cleaned = line.replace(/\s+/g, " ").trim();
      
      // Don't return if it's just common receipt text
      if (cleaned.length >= 5 && !/^(RECEIPT|INVOICE|ORDER|DATE|TIME)/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  return null;
}

/**
 * Get format by ID
 */
export function getReceiptFormatById(id: string): ReceiptFormat | null {
  return RECEIPT_FORMATS.find(f => f.id === id) || null;
}

/**
 * Get formats by category
 */
export function getReceiptFormatsByCategory(category: string): ReceiptFormat[] {
  return RECEIPT_FORMATS.filter(f => f.category === category);
}

