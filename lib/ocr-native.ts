/**
 * Native OCR wrapper for Capacitor
 * Uses ML Kit (Android) / Vision Framework (iOS) ONLY
 * NO FALLBACK - Native OCR only on mobile devices
 */

import { Capacitor } from '@capacitor/core';
import { isNativeApp } from './camera-native';
import { TextRecognition } from '@/src/plugins/text-recognition';

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
    console.log('[OCR] Not a native platform - OCR not available');
    return false;
  }
  
  // Plugin is available if Capacitor is loaded and we're in native app
  console.log('[OCR] Native OCR is available!');
  return true;
}

/**
 * Recognize text from image using native OCR (ML Kit/Vision) ONLY
 * NO FALLBACK - Will throw error if not in native app
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
    platform: Capacitor.getPlatform(),
  });
  
  // ONLY use native OCR - no fallback
  if (!isNative || !isAvailable) {
    const errorMsg = 'OCR is only available in the native mobile app. Please use the Android or iOS app.';
    console.error('[OCR] ERROR:', errorMsg);
    throw new Error(errorMsg);
  }
  
  console.log('[OCR] Using NATIVE OCR (ML Kit/Vision)');
  const startTime = Date.now();
  
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
  const pluginStartTime = Date.now();
  
  try {
    // Call native plugin
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
      stack: error?.stack,
      duration: `${pluginDuration}ms`,
    });
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

