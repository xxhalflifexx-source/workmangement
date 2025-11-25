# Step-by-Step Guide to Apply Database Migration

## Option 1: Using Database GUI Tool (Easiest)

### Step 1: Open Your Database Tool
- **pgAdmin**: Open pgAdmin and connect to your database
- **DBeaver**: Open DBeaver and connect to your database
- **Supabase Dashboard**: Go to your project → SQL Editor
- **Vercel Postgres**: Go to Vercel Dashboard → Storage → Your Database → SQL Editor
- **Railway/Render**: Use their database dashboard SQL editor

### Step 2: Open SQL Query Editor
- In pgAdmin: Right-click your database → Query Tool
- In DBeaver: Right-click database → SQL Editor → New SQL Script
- In Supabase: Click "SQL Editor" tab
- In Vercel: Click "SQL Editor" or "Query" tab

### Step 3: Copy the SQL Migration
Copy this entire SQL script:

```sql
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "dateDelivered" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "orderStatus" TEXT,
ADD COLUMN IF NOT EXISTS "requestNumber" TEXT,
ADD COLUMN IF NOT EXISTS "recommendedAction" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequest_requestNumber_key" 
ON "MaterialRequest"("requestNumber") 
WHERE "requestNumber" IS NOT NULL;
```

### Step 4: Paste and Execute
1. Paste the SQL into the query editor
2. Click "Run" or "Execute" button (or press F5)
3. Wait for "Success" message

### Step 5: Verify
Check that the columns were added:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'MaterialRequest';
```

You should see: `dateDelivered`, `orderStatus`, `requestNumber`, `recommendedAction`

---

## Option 2: Using Command Line (psql)

### Step 1: Install psql (if not installed)
- **Windows**: Download from https://www.postgresql.org/download/windows/
- **Mac**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql-client`

### Step 2: Get Your Database Connection String
From your `.env` file or hosting provider, find:
```
DATABASE_URL=postgresql://user:password@host:port/database
```

### Step 3: Connect to Database
```bash
psql "postgresql://user:password@host:port/database"
```

Or if you have connection details separately:
```bash
psql -h hostname -U username -d database_name
```

### Step 4: Run the Migration
Copy and paste the SQL commands one by one, or:

```bash
psql "your_connection_string" -f prisma/migrations/add_all_material_request_columns.sql
```

Or paste directly:
```sql
ALTER TABLE "MaterialRequest" 
ADD COLUMN IF NOT EXISTS "dateDelivered" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "orderStatus" TEXT,
ADD COLUMN IF NOT EXISTS "requestNumber" TEXT,
ADD COLUMN IF NOT EXISTS "recommendedAction" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequest_requestNumber_key" 
ON "MaterialRequest"("requestNumber") 
WHERE "requestNumber" IS NOT NULL;
```

### Step 5: Exit psql
Type `\q` and press Enter

---

## Option 3: Using Prisma Migrate (Recommended for Development)

### Step 1: Open Terminal in Project Directory
```bash
cd C:\Users\King\Documents\GitHub\workmangement
```

### Step 2: Run Prisma Migrate
```bash
npx prisma migrate deploy
```

This will apply all pending migrations including the new columns.

### Step 3: Generate Prisma Client
```bash
npx prisma generate
```

---

## Option 4: Using Prisma DB Push (Quick Development Fix)

### Step 1: Open Terminal
```bash
cd C:\Users\King\Documents\GitHub\workmangement
```

### Step 2: Push Schema Changes
```bash
npx prisma db push
```

This will sync your Prisma schema with the database (adds missing columns).

---

## For Vercel/Production Deployment

### If using Vercel Postgres:
1. Go to Vercel Dashboard
2. Select your project
3. Go to Storage → Your Postgres Database
4. Click "SQL Editor" or "Query"
5. Paste the SQL migration
6. Click "Run"

### If using Supabase:
1. Go to Supabase Dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Click "New query"
5. Paste the SQL migration
6. Click "Run" (or Ctrl+Enter)

---

## Verify Migration Success

After running the migration, verify with this query:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'MaterialRequest'
    AND column_name IN ('dateDelivered', 'orderStatus', 'requestNumber', 'recommendedAction')
ORDER BY column_name;
```

You should see all 4 columns listed.

---

## Troubleshooting

**Error: "relation MaterialRequest does not exist"**
- The table name might be lowercase: try `"materialrequest"` or `materialrequest`

**Error: "permission denied"**
- Make sure you're using a database user with ALTER TABLE permissions
- For production, you may need admin/owner access

**Error: "column already exists"**
- This is fine! The `IF NOT EXISTS` clause prevents errors
- The migration is safe to run multiple times

