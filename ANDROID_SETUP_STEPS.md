# Android Setup - Step by Step Guide

## ✅ Step 1: Database Migration (Do This First!)

1. Go to your Supabase dashboard
2. Click on "SQL Editor" in the left menu
3. Copy and paste the contents of `prisma/migrations/add_push_token_table.sql`
4. Click "Run"
5. Done! ✅

---

## 📥 Step 2: Install Android Studio

### Download:
1. Go to: https://developer.android.com/studio
2. Click the big "Download Android Studio" button
3. Save the file (it's about 1 GB, so grab a coffee ☕)

### Install:
1. Run the installer you just downloaded
2. Click "Next" through the setup wizard
3. **Important**: Make sure "Android SDK" is checked
4. Let it install (takes 10-30 minutes)
5. When done, click "Finish"

### First Launch:
1. Android Studio will open
2. It might download more stuff (SDK components) - let it finish
3. You'll see a welcome screen - that's good!

---

## 🛠️ Step 3: Install Android SDK Components

1. In Android Studio, click "More Actions" → "SDK Manager"
2. Make sure these are checked:
   - ✅ Android SDK Platform-Tools
   - ✅ Android SDK Build-Tools
   - ✅ Android SDK Platform (latest version)
3. Click "Apply" and let it download
4. Close SDK Manager

---

## 📱 Step 4: Enable Developer Mode on Your Android Phone

1. Go to Settings → About Phone
2. Find "Build Number" (might be under "Software Information")
3. Tap "Build Number" **7 times** (yes, really!)
4. You'll see "You are now a developer!"
5. Go back to Settings
6. You'll now see "Developer Options"
7. Open it and enable:
   - ✅ USB Debugging
   - ✅ Stay Awake (optional, but helpful)

---

## 🏗️ Step 5: Build Your Android App

Open PowerShell or Command Prompt in your project folder and run:

```bash
# 1. Build your web app for mobile
npm run build:mobile
```

This creates the `out` folder with your web app files.

```bash
# 2. Add Android platform to your project
npx cap add android
```

This creates the `android` folder with your Android project.

```bash
# 3. Copy your web app files to Android project
npx cap sync
```

This copies everything from `out` to `android/app/src/main/assets/public/`

---

## 🚀 Step 6: Open in Android Studio

```bash
npm run cap:android
```

This opens Android Studio with your project!

**First time opening:**
- Android Studio might ask to "Sync Gradle Files" - click "Sync Now"
- Wait for it to finish (might take a few minutes)
- You'll see your project files on the left

---

## 📲 Step 7: Test on Your Phone

1. Connect your Android phone to computer with USB cable
2. On your phone, when it asks "Allow USB debugging?" → Tap "Allow"
3. In Android Studio, look at the top toolbar
4. You should see your phone name in the device dropdown
5. Click the green "Run" button (▶️) or press `Shift + F10`
6. Wait for it to build and install (first time takes 5-10 minutes)
7. Your app should open on your phone! 🎉

---

## 🐛 Troubleshooting

### "No devices found"
- Make sure USB debugging is enabled on phone
- Try a different USB cable
- On phone, tap "Revoke USB debugging authorizations" then reconnect

### "Build failed"
- Make sure you ran `npm run build:mobile` first
- In Android Studio: File → Invalidate Caches → Invalidate and Restart

### "Gradle sync failed"
- Check your internet connection
- File → Settings → Build → Gradle → Use Gradle from: "gradle-wrapper.properties"
- Try again

### "App crashes when opening"
- Check Android Studio's "Logcat" tab for error messages
- Make sure you're testing on a real phone, not emulator (camera needs real device)

---

## ✅ What Success Looks Like

When everything works:
- ✅ App builds without errors
- ✅ App installs on your phone
- ✅ App opens and shows your login screen
- ✅ Camera button works (takes real photos!)
- ✅ Everything works like the web version

---

## 🎯 Next Steps After Testing

Once it works on your phone:
1. Create Google Play Developer account ($25)
2. Build a release version
3. Upload to Google Play Console
4. Submit for review

But first, let's get it working on your phone! 📱

---

## 💡 Pro Tips

- **Keep your phone connected** while testing - faster than unplugging/plugging
- **Use a good USB cable** - cheap cables can cause connection issues
- **First build is slow** - subsequent builds are much faster
- **Test camera on real phone** - emulators don't have real cameras

---

## Need Help?

If you get stuck:
1. Check the error message in Android Studio
2. Google the error message
3. Ask me specific questions!

Let's get your app on Android! 🚀

