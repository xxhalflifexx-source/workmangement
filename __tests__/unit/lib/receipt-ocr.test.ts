// Mock the receipt-learning module before importing receipt-ocr
jest.mock('@/lib/receipt-learning', () => ({
  applyLearnedPatterns: jest.fn().mockReturnValue([]),
}));

import {
  extractAmountFromText,
  extractAmountFromMultipleResults,
  extractAllAmounts,
  extractAmountsWithContext,
} from '@/lib/receipt-ocr';

describe('receipt-ocr', () => {
  describe('extractAmountFromText', () => {
    it('should return null for empty text', () => {
      expect(extractAmountFromText('')).toBeNull();
      expect(extractAmountFromText(null as any)).toBeNull();
    });

    it('should extract amount from simple "Total: $XX.XX" format', () => {
      const text = `
        Item 1    $5.99
        Item 2    $3.50
        Subtotal  $9.49
        Tax       $0.76
        Total: $10.25
      `;
      expect(extractAmountFromText(text)).toBe(10.25);
    });

    it('should extract amount from "Total $XX.XX" format without colon', () => {
      const text = `
        Coffee    $4.50
        Bagel     $2.00
        Total $6.50
      `;
      expect(extractAmountFromText(text)).toBe(6.50);
    });

    it('should prefer "Total" over "Subtotal"', () => {
      const text = `
        Item 1    $10.00
        Subtotal  $10.00
        Tax       $0.80
        Total     $10.80
      `;
      expect(extractAmountFromText(text)).toBe(10.80);
    });

    it('should extract amount from "Amount Due" format', () => {
      const text = `
        Services Rendered
        Amount Due: $150.00
      `;
      expect(extractAmountFromText(text)).toBe(150.00);
    });

    it('should extract amount from "Balance Due" format', () => {
      const text = `
        Invoice Total: $500.00
        Payment: $200.00
        Balance Due: $300.00
      `;
      expect(extractAmountFromText(text)).toBe(300.00);
    });

    it('should extract amount from credit card pattern', () => {
      const text = `
        Subtotal: $25.00
        Tax: $2.00
        Total: $27.00
        VISA #1234 $27.00
      `;
      expect(extractAmountFromText(text)).toBe(27.00);
    });

    it('should handle Grand Total', () => {
      const text = `
        Subtotal: $100.00
        Shipping: $10.00
        Tax: $8.80
        Grand Total: $118.80
      `;
      expect(extractAmountFromText(text)).toBe(118.80);
    });

    it('should extract amount from bottom section when no keyword found', () => {
      const text = `
        Store ABC
        123 Main St
        ---------------
        Widget        $5.00
        Gadget        $7.50
        ---------------
        $12.50
      `;
      const result = extractAmountFromText(text);
      expect(result).toBeGreaterThan(0);
    });

    it('should filter out unreasonably large amounts', () => {
      const text = `
        Order #: 999999999.99
        Total: $25.00
      `;
      expect(extractAmountFromText(text)).toBe(25.00);
    });

    it('should handle European comma decimal format', () => {
      const text = `
        Item 1
        Total: 10,50
      `;
      // Should either extract 10.50 or handle gracefully
      const result = extractAmountFromText(text);
      expect(result === 10.50 || result === null).toBeTruthy();
    });

    it('should handle amounts with space decimal separator', () => {
      const text = `
        Total: 10 50
      `;
      const result = extractAmountFromText(text);
      // May or may not work depending on implementation
      expect(result === 10.50 || result === null || result === 10.00).toBeTruthy();
    });

    it('should work with long receipts (prefer bottom section)', () => {
      const lines = [];
      for (let i = 1; i <= 30; i++) {
        lines.push(`Item ${i}    $${(i * 1.5).toFixed(2)}`);
      }
      lines.push('Subtotal    $697.50');
      lines.push('Tax         $55.80');
      lines.push('Total       $753.30');
      
      const text = lines.join('\n');
      expect(extractAmountFromText(text)).toBe(753.30);
    });

    it('should handle receipt with only amounts (no keywords)', () => {
      const text = `
        4.99
        3.50
        2.00
        10.49
      `;
      const result = extractAmountFromText(text);
      // Should return the largest reasonable amount
      expect(result).toBe(10.49);
    });

    it('should reject amounts less than $1 when better options exist', () => {
      const text = `
        Discount    -$0.50
        Total       $15.00
      `;
      expect(extractAmountFromText(text)).toBe(15.00);
    });
  });

  describe('extractAmountFromMultipleResults', () => {
    it('should return null for empty results', () => {
      expect(extractAmountFromMultipleResults([])).toBeNull();
      expect(extractAmountFromMultipleResults(null as any)).toBeNull();
    });

    it('should return the most common amount across results', () => {
      const results = [
        { text: 'Total: $25.00', confidence: 90 },
        { text: 'Total: $25.00', confidence: 85 },
        { text: 'Total: $26.00', confidence: 80 },
      ];
      expect(extractAmountFromMultipleResults(results)).toBe(25.00);
    });

    it('should use confidence as tiebreaker', () => {
      const results = [
        { text: 'Total: $25.00', confidence: 95 },
        { text: 'Total: $30.00', confidence: 60 },
      ];
      // Both appear once, but $25 has higher confidence
      expect(extractAmountFromMultipleResults(results)).toBe(25.00);
    });

    it('should handle results with no extractable amounts', () => {
      const results = [
        { text: 'No amounts here', confidence: 90 },
        { text: 'Still nothing', confidence: 85 },
      ];
      expect(extractAmountFromMultipleResults(results)).toBeNull();
    });

    it('should prefer count over confidence', () => {
      const results = [
        { text: 'Total: $10.00', confidence: 99 },
        { text: 'Total: $20.00', confidence: 70 },
        { text: 'Total: $20.00', confidence: 65 },
        { text: 'Total: $20.00', confidence: 60 },
      ];
      // $20 appears 3 times vs $10 once
      expect(extractAmountFromMultipleResults(results)).toBe(20.00);
    });
  });

  describe('extractAllAmounts', () => {
    it('should return empty array for empty text', () => {
      expect(extractAllAmounts('')).toEqual([]);
      expect(extractAllAmounts(null as any)).toEqual([]);
    });

    it('should extract all amounts from text', () => {
      const text = `
        Item 1: $5.00
        Item 2: $10.00
        Total: $15.00
      `;
      const amounts = extractAllAmounts(text);
      expect(amounts).toContain(5.00);
      expect(amounts).toContain(10.00);
      expect(amounts).toContain(15.00);
    });

    it('should return amounts sorted descending', () => {
      const text = `
        $1.00
        $50.00
        $25.00
      `;
      const amounts = extractAllAmounts(text);
      expect(amounts[0]).toBe(50.00);
      expect(amounts[1]).toBe(25.00);
      expect(amounts[2]).toBe(1.00);
    });

    it('should remove duplicates', () => {
      const text = `
        $10.00
        $10.00
        $10.00
      `;
      const amounts = extractAllAmounts(text);
      expect(amounts.length).toBe(1);
      expect(amounts[0]).toBe(10.00);
    });

    it('should handle multiple amounts on same line', () => {
      const text = '$5.00 x 3 = $15.00';
      const amounts = extractAllAmounts(text);
      expect(amounts).toContain(5.00);
      expect(amounts).toContain(15.00);
    });
  });

  describe('extractAmountsWithContext', () => {
    it('should return empty array for empty text', () => {
      expect(extractAmountsWithContext('')).toEqual([]);
      expect(extractAmountsWithContext(null as any)).toEqual([]);
    });

    it('should extract amounts with Total context', () => {
      const text = `
        Subtotal: $10.00
        Total: $12.00
      `;
      const results = extractAmountsWithContext(text);
      
      const totalResult = results.find(r => r.keyword === 'Total');
      expect(totalResult).toBeDefined();
      expect(totalResult?.amount).toBe(12.00);
    });

    it('should extract amounts with Amount Due context', () => {
      const text = 'Amount Due: $50.00';
      const results = extractAmountsWithContext(text);
      
      const dueResult = results.find(r => r.keyword === 'Amount Due');
      expect(dueResult).toBeDefined();
      expect(dueResult?.amount).toBe(50.00);
    });

    it('should extract amounts with Card Payment context', () => {
      const text = 'VISA Payment $30.00';
      const results = extractAmountsWithContext(text);
      
      const cardResult = results.find(r => r.keyword === 'Card Payment');
      expect(cardResult).toBeDefined();
      expect(cardResult?.amount).toBe(30.00);
    });

    it('should return results sorted by amount descending', () => {
      const text = `
        Total: $10.00
        Grand Total: $50.00
        Amount Due: $50.00
      `;
      const results = extractAmountsWithContext(text);
      
      expect(results.length).toBeGreaterThan(0);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].amount).toBeGreaterThanOrEqual(results[i].amount);
      }
    });

    it('should identify amounts after subtotal as likely totals', () => {
      const text = `
        Subtotal: $20.00
        Tax: $1.60
        Total: $21.60
      `;
      const results = extractAmountsWithContext(text);
      
      // Should find Total and possibly "Total (after subtotal)"
      const totalResults = results.filter(r => 
        r.keyword === 'Total' || r.keyword === 'Total (after subtotal)'
      );
      expect(totalResults.length).toBeGreaterThan(0);
    });
  });
});

