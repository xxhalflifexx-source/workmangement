# 🔍 Live Website (Vercel) - Troubleshooting

## What To Check First

### Step 1: Check Vercel Deployment Status

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Click on your project: `nextjs-auth-roles`

2. **Check Latest Deployment:**
   - Look at the top deployment
   - Does it show "Ready" ✅ or "Building" ⏳ or "Error" ❌?
   - What's the commit message? Should say something about invoices

3. **If it shows "Error":**
   - Click on it to see the error
   - Check the build logs
   - Tell me what error you see

4. **If it shows "Building":**
   - Wait 2-3 minutes for it to finish
   - Then refresh your website

---

## Step 2: Check If Database Migration Was Run

**This is IMPORTANT!** The new invoice features need new database fields.

### Did you run the migration in Supabase?

**If NO - You need to do this:**

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Click your project

2. **Open SQL Editor:**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

3. **Paste and Run This SQL:**
   ```sql
   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sentDate" TIMESTAMP;
   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "releaseDate" TIMESTAMP;
   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "collectionDate" TIMESTAMP;
   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "creditDate" TIMESTAMP;

   CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
   ```

4. **Click "Run"**
   - Should see "Success"

**If YES - Skip to Step 3**

---

## Step 3: Hard Refresh Your Browser

The website might be showing cached old code:

1. **Hard Refresh:**
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Or Clear Cache:**
   - Press `F12` (open DevTools)
   - Right-click the refresh button
   - Click "Empty Cache and Hard Reload"

---

## Step 4: Check Browser Console for Errors

1. **Open DevTools:**
   - Press `F12`
   - Click "Console" tab

2. **Look for Red Errors:**
   - Any errors about invoices?
   - Any errors about statistics?
   - Any database errors?

3. **Tell me what errors you see**

---

## Step 5: Verify Code Was Deployed

Check if Vercel has your latest code:

1. **In Vercel Dashboard:**
   - Go to your project
   - Click "Deployments" tab
   - Look at the latest deployment
   - Check the commit message

2. **Should see commits like:**
   - "Add invoice fields and fix TypeScript error"
   - "Invoice features update"
   - "Fix TypeScript error in invoices statistics"

3. **If you see old commits:**
   - The code might not be deployed yet
   - Check if there are any build errors

---

## Common Issues on Live Site

### Issue 1: Database Migration Not Run
**Symptom:** Statistics show $0.00, errors in console
**Fix:** Run the SQL migration in Supabase (Step 2 above)

### Issue 2: Old Code Cached
**Symptom:** See old simple table, no statistics cards
**Fix:** Hard refresh (`Ctrl + Shift + R`)

### Issue 3: Build Failed
**Symptom:** Vercel shows "Error" status
**Fix:** Check build logs, might need to fix errors

### Issue 4: Environment Variables Missing
**Symptom:** Database errors, can't load invoices
**Fix:** Check Vercel → Settings → Environment Variables

---

## Quick Diagnostic

**Tell me:**

1. **What do you see on the invoices page?**
   - Old simple table?
   - Statistics cards?
   - Charts?
   - Filters?

2. **What does Vercel dashboard show?**
   - Latest deployment status?
   - Any build errors?

3. **Did you run the database migration?**
   - Yes/No

4. **Any errors in browser console?**
   - Press F12 → Console tab
   - What do you see?

---

## Most Likely Issue

**The database migration probably wasn't run yet!**

The new invoice features need these database fields:
- `invoiceNumber`
- `sentDate`
- `releaseDate`
- `collectionDate`
- `creditDate`

**Without these fields, the page might:**
- Show errors
- Not load statistics
- Not show the new features

**Solution:** Run the SQL migration in Supabase (Step 2 above)

---

## After Running Migration

1. **Run the SQL in Supabase** (Step 2)
2. **Hard refresh your browser** (`Ctrl + Shift + R`)
3. **Check the invoices page again**
4. **Should see all the new features!** ✅

---

**Let me know what you find and I'll help you fix it!** 🔧

