/**
 * Text Recognition Plugin Registration
 * Registers the plugin with Capacitor
 */

import { registerPlugin } from '@capacitor/core';
import type { TextRecognitionPlugin } from './definitions';

const TextRecognition = registerPlugin<TextRecognitionPlugin>('TextRecognition', {
  web: () => import('./web').then(m => new m.TextRecognitionWeb()),
});

export * from './definitions';
export { TextRecognition };

// Export default for easier imports
export default TextRecognition;

