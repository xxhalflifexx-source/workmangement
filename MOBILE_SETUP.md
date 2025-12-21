# Mobile App Setup Guide

This guide will help you set up iOS and Android apps using Capacitor.

## Prerequisites

- Node.js installed
- For iOS: macOS with Xcode installed
- For Android: Android Studio installed
- Apple Developer account ($99/year) for iOS App Store
- Google Play Developer account ($25 one-time) for Android Play Store

## Initial Setup

### 1. Build the web app for mobile

```bash
npm run build:mobile
```

This creates a static export in the `out` directory.

### 2. Initialize Capacitor platforms

```bash
# Add iOS platform
npx cap add ios

# Add Android platform
npx cap add android
```

This creates the `ios/` and `android/` directories.

### 3. Sync web assets to native projects

```bash
npx cap sync
```

This copies your web app files to the native projects.

## Development

### Open in native IDEs

```bash
# Open iOS project in Xcode
npm run cap:ios

# Open Android project in Android Studio
npm run cap:android
```

### Build and sync workflow

1. Make changes to your Next.js app
2. Run `npm run build:mobile`
3. Run `npm run cap:sync` to copy changes to native projects
4. Open in Xcode/Android Studio to test

## iOS Configuration

### 1. Configure Bundle ID

In Xcode:
- Select your project
- Go to "Signing & Capabilities"
- Set Bundle Identifier (e.g., `com.workmanagement.app`)

### 2. Configure App Icons

- Add app icons to `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Required sizes: 20x20, 29x29, 40x40, 60x60, 76x76, 83.5x83.5, 1024x1024

### 3. Configure Splash Screen

- Add splash screen images to `ios/App/App/Assets.xcassets/Splash.imageset/`

### 4. Camera Permissions

Camera permissions are already configured in `capacitor.config.ts`. Make sure `Info.plist` includes:
- `NSCameraUsageDescription`: "This app uses your camera to scan receipts for expense tracking."

## Android Configuration

### 1. Configure Package Name

In `android/app/build.gradle`:
```gradle
android {
    namespace "com.workmanagement.app"
    defaultConfig {
        applicationId "com.workmanagement.app"
    }
}
```

### 2. Configure App Icons

- Add app icons to `android/app/src/main/res/mipmap-*/`
- Create different densities: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi

### 3. Camera Permissions

Camera permissions are configured in `AndroidManifest.xml`. Should include:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

## Push Notifications Setup

### iOS (Apple Push Notification Service)

1. Create APNs key in Apple Developer account
2. Upload key to your server
3. Configure in `capacitor.config.ts`

### Android (Firebase Cloud Messaging)

1. Create Firebase project
2. Add `google-services.json` to `android/app/`
3. Configure FCM in your server

## Building for Production

### iOS

1. Open project in Xcode
2. Select "Any iOS Device" or your device
3. Product > Archive
4. Upload to App Store Connect

### Android

1. Build release APK/AAB:
```bash
cd android
./gradlew assembleRelease
# or
./gradlew bundleRelease
```

2. Sign the APK/AAB
3. Upload to Google Play Console

## Testing

### Test on Physical Devices

1. Connect device via USB
2. Enable developer mode
3. Run from Xcode/Android Studio

### Test Camera

- Native camera should work better than web camera
- Test both camera capture and gallery selection
- Verify permissions are requested correctly

### Test Offline Mode

- Turn off WiFi/data
- Try scanning receipts
- Verify data is queued
- Turn on network
- Verify sync happens automatically

## Troubleshooting

### Build Errors

- Make sure `out` directory exists after `npm run build:mobile`
- Run `npx cap sync` after every build
- Clear build folders in Xcode/Android Studio

### Camera Not Working

- Check permissions in device settings
- Verify `Info.plist` (iOS) or `AndroidManifest.xml` (Android) has camera permissions
- Check console logs for errors

### Sync Issues

- Make sure you run `npx cap sync` after building
- Check that `capacitor.config.ts` has correct `webDir` path (`out`)

## Next Steps

1. Generate app icons and splash screens
2. Configure App Store Connect listing
3. Configure Google Play Console listing
4. Set up CI/CD for automated builds
5. Test on multiple devices
6. Submit for review

