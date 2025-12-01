# 🚀 Migration Guide: Add Amount Field to MaterialRequest

## ✅ Option 1: Supabase SQL Editor (EASIEST - Recommended)

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Sign in to your account
3. Select your project

### Step 2: Open SQL Editor
1. Click **"SQL Editor"** in the left sidebar
2. Click **"New Query"** button (top right)

### Step 3: Run the Migration SQL
Copy and paste this SQL code:

```sql
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION;

COMMENT ON COLUMN "MaterialRequest"."amount" IS 'Cost/amount for the material request - required before status update to APPROVED or FULFILLED';
```

### Step 4: Execute
1. Click **"Run"** button (or press `Ctrl + Enter`)
2. You should see: **"Success. No rows returned"**

### ✅ Done! The migration is complete.

---

## 🔧 Option 2: Using Prisma Migrate (For Local Development)

### Step 1: Open Terminal
- **In Cursor:** Press `Ctrl + ~` (Control + Tilde)
- **Or Windows PowerShell:** Press `Windows Key + X` → Click "Windows PowerShell"

### Step 2: Navigate to Project
```powershell
cd "C:\Users\King\Documents\GitHub\workmangement"
```

### Step 3: Run Migration
```bash
npx prisma migrate dev --name add_amount_to_material_request
```

**What this does:**
- Creates a migration file
- Applies changes to your database
- Updates Prisma client

### Step 4: Regenerate Prisma Client
```bash
npx prisma generate
```

### ✅ Done!

---

## 🎯 Which Option Should You Use?

- **Use Option 1 (Supabase SQL Editor)** if:
  - ✅ You want the simplest method
  - ✅ You're working directly with production database
  - ✅ You don't have Prisma set up locally

- **Use Option 2 (Prisma Migrate)** if:
  - ✅ You have local database setup
  - ✅ You want to track migration history
  - ✅ You're working with a team

---

## ✅ Verify It Worked

After running the migration:

1. **In Supabase Dashboard:**
   - Go to **"Table Editor"**
   - Click on **"MaterialRequest"** table
   - You should see a new **"amount"** column

2. **Or test in your app:**
   - Go to Inventory → Materials Requested
   - You should see the "Amount" column in the table
   - Try entering an amount for a request

---

## 🐛 Troubleshooting

### Problem: "Column already exists"
**Solution:** The migration already ran. You can skip it.

### Problem: "Permission denied"
**Solution:** Make sure you're logged in as the project owner or have database admin permissions.

### Problem: "Table not found"
**Solution:** Check that your table is named exactly `MaterialRequest` (case-sensitive in PostgreSQL).

---

## 📝 Summary

**Quickest Method:**
1. Go to Supabase Dashboard → SQL Editor
2. Paste the SQL from `migration_add_amount_to_material_request.sql`
3. Click Run
4. Done! ✅

