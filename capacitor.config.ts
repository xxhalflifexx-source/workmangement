import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.workmanagement.app',
  appName: 'Work Management',
  webDir: 'public', // Use public directory (will be empty, server handles rendering)
  server: {
    // Point to your deployed server URL
    url: process.env.CAPACITOR_SERVER_URL || 'https://shoptofield.com/app',
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    Camera: {
      permissions: {
        camera: 'This app uses your camera to scan receipts for expense tracking.',
      },
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    TextRecognition: {
      // Local plugin - registered via @CapacitorPlugin annotation in Android
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: true,
    // Enable cookies for session management
    captureInput: true,
    webContentsDebuggingEnabled: true, // Enable debugging
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;

