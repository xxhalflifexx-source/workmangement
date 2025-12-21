/**
 * Text Recognition Plugin Definitions
 * Interface for native OCR capabilities
 */

export interface TextRecognitionPlugin {
  /**
   * Recognize text from an image
   * @param options - Image data and format
   * @returns Promise with recognized text and confidence score
   */
  recognize(options: {
    image: string; // Base64 encoded image
    imageFormat: string; // 'jpeg', 'png', etc.
  }): Promise<{
    text: string;
    confidence: number; // 0-100
  }>;
}

