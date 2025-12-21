# Quick Start - Android App

## ✅ What We Just Did

1. ✅ Built your web app
2. ✅ Added Android platform
3. ✅ Synced files to Android project
4. ✅ Opened Android Studio

## 🔧 IMPORTANT: Update Server URL

Before testing on your phone, you need to update the server URL in `capacitor.config.ts`:

1. Open `capacitor.config.ts` in your project
2. Find the line: `url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:3000',`
3. Change it to your deployed Vercel URL, for example:
   ```typescript
   url: 'https://your-app-name.vercel.app',
   ```
4. Remove the `cleartext: true` line (only needed for localhost)
5. Save the file
6. Run `npx cap sync` again

## 📱 Testing on Your Phone

### In Android Studio:

1. **Wait for Gradle Sync** (first time takes a few minutes)
   - Look at the bottom of Android Studio
   - Wait for "Gradle sync finished" message

2. **Connect Your Phone**
   - Plug phone into computer with USB
   - On phone: Tap "Allow USB debugging" if prompted
   - In Android Studio: Check top toolbar - you should see your phone name

3. **Run the App**
   - Click the green ▶️ Run button (or press Shift+F10)
   - Wait for build to finish (first time: 5-10 minutes)
   - App will install and open on your phone!

## 🐛 Troubleshooting

### "No devices found"
- Make sure USB debugging is enabled on phone
- Try a different USB cable
- On phone: Settings → Developer Options → Revoke USB debugging authorizations, then reconnect

### "Build failed" or "Gradle sync failed"
- Check internet connection (Gradle downloads dependencies)
- File → Invalidate Caches → Invalidate and Restart
- Try again

### "App opens but shows blank screen"
- Check that server URL in `capacitor.config.ts` is correct
- Make sure your Vercel app is deployed and running
- Check Android Studio Logcat for errors

### "Camera doesn't work"
- Make sure you're testing on a real phone (not emulator)
- Check that camera permissions are granted on phone
- Settings → Apps → Your App → Permissions → Camera → Allow

## 🎯 What Should Happen

When everything works:
- ✅ App builds without errors
- ✅ App installs on your phone
- ✅ App opens and shows your login screen
- ✅ You can log in
- ✅ Camera button works (takes real photos!)
- ✅ Everything works like the web version

## 📝 Next Steps After Testing

Once it works:
1. Update server URL to production
2. Test all features (camera, receipts, etc.)
3. Build release version
4. Create Google Play Developer account ($25)
5. Upload to Google Play Console
6. Submit for review

## 💡 Pro Tips

- **First build is slow** - be patient, subsequent builds are faster
- **Keep phone connected** - faster than unplugging/plugging
- **Check Logcat** - shows errors and debug info (bottom tab in Android Studio)
- **Test on real phone** - emulators don't have real cameras

Good luck! 🚀
