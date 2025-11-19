# Step-by-Step Migration Guide: Adding Invoice Number and Date Fields

This guide will walk you through running the database migration to add the new invoice fields.

## 📋 What This Migration Does

This migration adds the following fields to your Invoice table:
- `invoiceNumber` - Auto-generated invoice numbers (INV-250001, INV-250002, etc.)
- `sentDate` - When the invoice was sent to the customer
- `releaseDate` - When the invoice was released/approved
- `collectionDate` - When payment was collected
- `creditDate` - Credit memo date if applicable

---

## 🎯 Step 1: Choose Your Database Type

You have two options:

### Option A: Use SQLite (Local Development - EASIER)
- ✅ No setup needed
- ✅ Works offline
- ✅ Good for testing
- ❌ Not for production

### Option B: Use PostgreSQL (Production Ready)
- ✅ Production-ready
- ✅ Better performance
- ❌ Requires database credentials

**For now, let's use SQLite for local development (Option A).**

---

## 🔧 Step 2: Switch Schema to SQLite (If Needed)

If your `prisma/schema.prisma` currently says `provider = "postgresql"`, we need to temporarily switch it to SQLite.

### 2.1: Open `prisma/schema.prisma`

### 2.2: Change the datasource section from:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 2.3: To this (for SQLite):
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

**Note:** Remove the `directUrl` line - SQLite doesn't need it.

---

## 🚀 Step 3: Run the Migration

### 3.1: Open Terminal in Cursor

**In Cursor:**
- Press `Ctrl + ~` (Control + Tilde) to open terminal
- OR click the "Terminal" tab at the bottom

**Or use Windows PowerShell:**
- Press `Windows Key + X`
- Click "Windows PowerShell"
- Navigate to your project:
  ```powershell
  cd "C:\Users\King\Documents\GitHub\workmangement"
  ```

### 3.2: Run the Migration Command

Type this command and press Enter:

```bash
npx prisma migrate dev --name add_invoice_number_and_dates
```

**What this does:**
- Creates a new migration file
- Applies the changes to your database
- Updates your Prisma client

### 3.3: What You'll See

You should see output like:
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./dev.db"

Applying migration `20250120_add_invoice_number_and_dates`
The following migration(s) have been created and applied from new schema changes:

  prisma/migrations/20250120_add_invoice_number_and_dates/migration.sql

✔ Generated Prisma Client (5.x.x)
```

**✅ Success!** The migration is complete!

---

## 🔄 Step 4: Regenerate Prisma Client

After the migration, regenerate the Prisma client to include the new fields:

```bash
npx prisma generate
```

You should see:
```
✔ Generated Prisma Client (5.x.x) to .\node_modules\.prisma\client
```

---

## ✅ Step 5: Verify It Worked

### 5.1: Check the Migration File

Open: `prisma/migrations/[timestamp]_add_invoice_number_and_dates/migration.sql`

You should see SQL commands like:
```sql
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "sentDate" DATETIME;
-- etc.
```

### 5.2: Open Prisma Studio (Optional - Visual Check)

Run this command to open a visual database browser:

```bash
npx prisma studio
```

This will open a browser window where you can:
- See your Invoice table
- Check that the new columns exist
- View your data

**To close Prisma Studio:** Press `Ctrl + C` in the terminal

---

## 🐛 Troubleshooting

### Problem: "Environment variable not found: DATABASE_URL"

**Solution:** You need to switch to SQLite (see Step 2) OR create a `.env` file with your database credentials.

### Problem: "Migration failed"

**Solution:** 
1. Check if your database file exists: `prisma/dev.db`
2. Make sure no other process is using the database
3. Try deleting `prisma/dev.db` and running the migration again (⚠️ This deletes all data!)

### Problem: "Cannot find module 'prisma'"

**Solution:** Install dependencies first:
```bash
npm install
```

### Problem: "Migration already exists"

**Solution:** The migration was already applied. You can skip to Step 4 (regenerate Prisma client).

---

## 📝 Alternative: Manual SQL (If Migration Fails)

If the automatic migration doesn't work, you can run the SQL manually:

### For SQLite:

1. Open your database file: `prisma/dev.db`
2. Use a SQLite browser tool (like DB Browser for SQLite)
3. Run this SQL:

```sql
ALTER TABLE "Invoice" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "sentDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "releaseDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "collectionDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "creditDate" DATETIME;

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
```

---

## 🎉 Step 6: Test It!

After the migration is complete:

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Go to:** http://localhost:3000/invoices

3. **Create a new invoice** - it should automatically get invoice number `INV-250001`

4. **Check the invoice table** - you should see the new columns

---

## 🔄 Switching Back to PostgreSQL (Later)

When you're ready for production:

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```

2. Create `.env` file with your PostgreSQL credentials

3. Run the migration again:
   ```bash
   npx prisma migrate deploy
   ```

---

## 📚 Summary

**Quick Commands:**
```bash
# 1. Switch schema to SQLite (edit prisma/schema.prisma)
# 2. Run migration
npx prisma migrate dev --name add_invoice_number_and_dates

# 3. Regenerate client
npx prisma generate

# 4. Test it
npm run dev
```

**That's it!** Your database now has the new invoice fields! 🎊

