# 📋 Complete Step-by-Step Guide

## Part 1: Add New Invoice Fields to Database

### Option A: Using Supabase Dashboard (EASIEST)

1. **Go to Supabase:**
   - Visit: https://supabase.com/dashboard
   - Login and click your project

2. **Open SQL Editor:**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

3. **Copy and Paste This SQL:**
   ```sql
   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sentDate" TIMESTAMP;
   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "releaseDate" TIMESTAMP;
   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "collectionDate" TIMESTAMP;
   ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "creditDate" TIMESTAMP;

   CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
   ```

4. **Click "Run" button**
   - Should see "Success. No rows returned"
   - ✅ Database is updated!

---

### Option B: Using Terminal (If you prefer)

1. **Open Terminal in Cursor:**
   - Press `Ctrl + ~`

2. **Run these commands one by one:**

   ```bash
   npm i -g vercel
   ```

   ```bash
   vercel login
   ```
   (Opens browser - click "Authorize")

   ```bash
   vercel env pull .env.local
   ```

   ```bash
   npx prisma migrate deploy
   ```

   ✅ Database is updated!

---

## Part 2: Push Code to GitHub ⚠️ REQUIRED!

**YES, you MUST push to GitHub after running the migration!**

### Step 1: Open Terminal in Cursor
- Press `Ctrl + ~`
- OR click "Terminal" tab at bottom

### Step 2: Check What Changed
```bash
git status
```

You should see files like:
- `prisma/schema.prisma`
- `prisma/migrations/migration_lock.toml`
- `app/invoices/page.tsx`

### Step 3: Add All Changes
```bash
git add .
```

### Step 4: Commit with Message
```bash
git commit -m "Add invoice fields and fix TypeScript error"
```

### Step 5: Push to GitHub
```bash
git push
```

**Wait 1-2 minutes** - Vercel will automatically rebuild!

---

## ✅ Final Checklist

- [ ] Ran migration in Supabase (Option A) OR ran `npx prisma migrate deploy` (Option B)
- [ ] Pushed code to GitHub (Part 2 above)
- [ ] Checked Vercel dashboard - build should succeed
- [ ] Tested the app - invoices should work!

---

## 🎯 Summary

**What you did:**
1. ✅ Added new invoice fields to database
2. ✅ Pushed code to GitHub
3. ✅ Vercel rebuilt automatically

**Result:**
- ✅ Your app works again
- ✅ New invoice features are available
- ✅ No more database errors

---

**Remember: Always push to GitHub after making changes!** 🚀

