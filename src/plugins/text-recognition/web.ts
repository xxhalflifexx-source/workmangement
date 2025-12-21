/**
 * Web implementation of Text Recognition Plugin
 * OCR is ONLY available in native mobile apps (Android/iOS)
 * This web implementation returns an error
 */

import type { TextRecognitionPlugin } from './definitions';

export class TextRecognitionWeb implements TextRecognitionPlugin {
  async recognize(options: { image: string; imageFormat: string }): Promise<{ text: string; confidence: number }> {
    console.error('[OCR] Web plugin called - OCR is only available in native mobile apps');
    throw new Error('Text Recognition is only available in the native mobile app (Android/iOS). Please use the mobile app to scan receipts.');
  }
}

