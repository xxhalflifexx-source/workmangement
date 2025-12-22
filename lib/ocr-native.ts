/**
 * Native OCR wrapper for Capacitor
 * Uses ML Kit (Android) / Vision Framework (iOS) for native apps
 * Falls back to Tesseract.js for web browsers
 */

import { Capacitor } from '@capacitor/core';
import { isNativeApp } from './camera-native';
import { TextRecognition } from '@/src/plugins/text-recognition';
import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
}

/**
 * Check if native OCR is available
 */
function isNativeOCRAvailable(): boolean {
  if (typeof window === 'undefined') {
    console.log('[OCR] Window undefined - not available');
    return false;
  }
  
  // Check if Capacitor is available
  const capacitor = (window as any).Capacitor;
  if (!capacitor) {
    console.log('[OCR] Capacitor not found - not available');
    return false;
  }
  
  // Check if we're in a native app
  const isNative = Capacitor.isNativePlatform();
  console.log('[OCR] Native platform check:', {
    isNative,
    platform: Capacitor.getPlatform(),
    userAgent: navigator.userAgent,
  });
  
  if (!isNative) {
    console.log('[OCR] Not a native platform - will use Tesseract.js fallback');
    return false;
  }
  
  // Plugin is available if Capacitor is loaded and we're in native app
  console.log('[OCR] Native OCR is available!');
  return true;
}

/**
 * Recognize text from image using native OCR (ML Kit/Vision) or Tesseract.js fallback
 */
export async function recognizeText(imageFile: File): Promise<OCRResult> {
  console.log('[OCR] Starting OCR recognition...');
  console.log('[OCR] File info:', {
    name: imageFile.name,
    type: imageFile.type,
    size: imageFile.size,
  });
  
  const isNative = isNativeApp();
  const isAvailable = isNativeOCRAvailable();
  
  console.log('[OCR] Environment check:', {
    isNativeApp: isNative,
    isNativeOCRAvailable: isAvailable,
  });
  
  const startTime = Date.now();
  
  // Use native OCR if available, otherwise use Tesseract.js
  if (isNative && isAvailable) {
    console.log('[OCR] Using NATIVE OCR (ML Kit/Vision)');
    try {
      const result = await recognizeTextNative(imageFile);
      const duration = Date.now() - startTime;
      console.log('[OCR] Native OCR completed successfully:', {
        textLength: result.text.length,
        confidence: result.confidence,
        duration: `${duration}ms`,
      });
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[OCR] Native OCR failed:', {
        error: error?.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  } else {
    // Use Tesseract.js for web browsers
    console.log('[OCR] Using Tesseract.js (web fallback)');
    try {
      const result = await recognizeTextTesseract(imageFile);
      const duration = Date.now() - startTime;
      console.log('[OCR] Tesseract.js OCR completed successfully:', {
        textLength: result.text.length,
        confidence: result.confidence,
        duration: `${duration}ms`,
      });
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[OCR] Tesseract.js OCR failed:', {
        error: error?.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }
}

/**
 * Tesseract.js OCR for web browsers
 */
async function recognizeTextTesseract(imageFile: File): Promise<OCRResult> {
  console.log('[OCR] Tesseract.js: Starting recognition...');
  
  try {
    // Create image URL from file
    const imageUrl = URL.createObjectURL(imageFile);
    
    // Use Tesseract.js to recognize text
    const result = await Tesseract.recognize(
      imageUrl,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Tesseract progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );
    
    // Clean up blob URL
    URL.revokeObjectURL(imageUrl);
    
    const text = result.data.text || '';
    const confidence = result.data.confidence || 0;
    
    console.log('[OCR] Tesseract.js result:', {
      textLength: text.length,
      confidence: confidence,
    });
    
    return {
      text,
      confidence,
    };
  } catch (error: any) {
    console.error('[OCR] Tesseract.js error:', error);
    throw new Error(`Tesseract OCR failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Native OCR using ML Kit (Android) / Vision Framework (iOS)
 * Uses the Capacitor TextRecognition plugin
 */
async function recognizeTextNative(imageFile: File): Promise<OCRResult> {
  console.log('[OCR] Converting image to base64...');
  const base64 = await fileToBase64(imageFile);
  console.log('[OCR] Base64 conversion complete, length:', base64.length);
  
  // Determine image format from file type
  const imageFormat = imageFile.type.includes('png') ? 'png' : 'jpeg';
  console.log('[OCR] Image format:', imageFormat);
  
  console.log('[OCR] Calling native TextRecognition plugin...');
  console.log('[OCR] Plugin check:', {
    pluginExists: typeof TextRecognition !== 'undefined',
    pluginMethods: TextRecognition ? Object.keys(TextRecognition) : [],
  });
  
  const pluginStartTime = Date.now();
  
  try {
    // Check if plugin method exists
    if (!TextRecognition || typeof TextRecognition.recognize !== 'function') {
      throw new Error('TextRecognition plugin not found. Make sure the plugin is registered in Android.');
    }
    
    // Call native plugin
    console.log('[OCR] Calling TextRecognition.recognize with:', {
      imageLength: base64.length,
      imageFormat,
    });
    
    const result = await TextRecognition.recognize({
      image: base64,
      imageFormat: imageFormat,
    });
    
    const pluginDuration = Date.now() - pluginStartTime;
    console.log('[OCR] Native plugin returned:', {
      textLength: result.text?.length || 0,
      confidence: result.confidence,
      duration: `${pluginDuration}ms`,
    });
    
    return {
      text: result.text || '',
      confidence: result.confidence || 95, // Native OCR is very accurate
    };
  } catch (error: any) {
    const pluginDuration = Date.now() - pluginStartTime;
    console.error('[OCR] Native plugin error:', {
      error: error?.message,
      errorName: error?.name,
      stack: error?.stack,
      duration: `${pluginDuration}ms`,
    });
    
    // Provide more helpful error message
    if (error?.message?.includes('not implemented') || error?.message?.includes('not found')) {
      throw new Error('TextRecognition plugin is not implemented on Android. Please rebuild the app: 1) Run "npx cap sync android" 2) Clean and rebuild in Android Studio');
    }
    
    throw new Error(`Native OCR failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Convert File to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

