/**
 * Native camera wrapper for Capacitor
 * Falls back to web camera if not in native app
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface CameraOptions {
  quality?: number; // 0-100
  allowEditing?: boolean;
  source?: CameraSource;
  resultType?: CameraResultType;
}

export interface CameraPhoto {
  webPath: string;
  format: string;
  base64String?: string;
}

/**
 * Check if running in Capacitor (native app)
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor?.isNativePlatform();
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  if (!isNativeApp()) {
    // Web browsers handle permissions automatically
    return true;
  }

  try {
    const status = await Camera.checkPermissions();
    
    if (status.camera === 'granted') {
      return true;
    }

    if (status.camera === 'prompt' || status.camera === 'prompt-with-rationale') {
      const result = await Camera.requestPermissions();
      return result.camera === 'granted';
    }

    return false;
  } catch (error) {
    console.error('[Camera] Permission request failed:', error);
    return false;
  }
}

/**
 * Take a photo using native camera or web file input
 */
export async function takePhoto(options: CameraOptions = {}): Promise<File | null> {
  const {
    quality = 90,
    allowEditing = false,
    source = CameraSource.Camera,
    resultType = CameraResultType.DataUrl,
  } = options;

  if (isNativeApp()) {
    try {
      // Request permissions first
      const hasPermission = await requestCameraPermissions();
      if (!hasPermission) {
        throw new Error('Camera permission denied');
      }

      // Take photo with native camera
      const photo = await Camera.getPhoto({
        quality,
        allowEditing,
        source: source || CameraSource.Camera,
        resultType,
        correctOrientation: true,
        saveToGallery: false,
      });

      // Convert Capacitor photo to File object
      if (photo.dataUrl) {
        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `receipt_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        return file;
      }

      throw new Error('Failed to get photo data');
    } catch (error: any) {
      console.error('[Camera] Native camera failed:', error);
      throw error;
    }
  } else {
    // Fallback to web file input (handled by parent component)
    return null;
  }
}

/**
 * Pick photo from gallery (native only)
 */
export async function pickFromGallery(): Promise<File | null> {
  if (!isNativeApp()) {
    return null;
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      source: CameraSource.Photos,
      resultType: CameraResultType.DataUrl,
      correctOrientation: true,
    });

    if (photo.dataUrl) {
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `receipt_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      return file;
    }

    return null;
  } catch (error: any) {
    console.error('[Camera] Gallery pick failed:', error);
    return null;
  }
}

