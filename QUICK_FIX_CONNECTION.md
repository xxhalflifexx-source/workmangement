# Quick Fix: Update DIRECT_URL in .env File

If you can't find the connection string in Supabase, you can try this quick fix:

## Current DIRECT_URL in Your .env File:
```
DIRECT_URL=postgresql://postgres:2003Chevys10!@db.supabase.com:5432/postgres
```

## Try These Variations:

### Option 1: Add SSL Parameter
Sometimes Supabase requires SSL. Try:
```
DIRECT_URL=postgresql://postgres:2003Chevys10!@db.supabase.com:5432/postgres?sslmode=require
```

### Option 2: Use Pooler URL (Temporary)
If direct connection doesn't work, try using the pooler:
```
DIRECT_URL=postgresql://postgres:2003Chevys10!@db.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Note:** This might not work for migrations, but worth trying.

### Option 3: Check Your Password
Make sure the password `2003Chevys10!` is correct:
- Check if you have the right password
- Make sure there are no extra spaces
- Verify special characters are correct

---

## How to Update .env File:

1. Open `.env` file in Notepad or VS Code
2. Find the line: `DIRECT_URL=...`
3. Replace it with one of the options above
4. Save the file (Ctrl + S)
5. Try the migration again:
   ```
   npx prisma migrate dev --name add_user_access_overrides
   ```

---

## Alternative: Run SQL Directly in Supabase

If migrations still don't work, you can create the table manually:

1. Go to Supabase Dashboard
2. Click **"SQL Editor"** (in left menu)
3. Click **"New query"**
4. Paste this SQL:

```sql
CREATE TABLE IF NOT EXISTS "UserAccessOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "access" TEXT NOT NULL DEFAULT 'allowed',
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAccessOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserAccessOverride_userId_componentName_key" ON "UserAccessOverride"("userId", "componentName");

CREATE INDEX IF NOT EXISTS "UserAccessOverride_userId_idx" ON "UserAccessOverride"("userId");

CREATE INDEX IF NOT EXISTS "UserAccessOverride_componentName_idx" ON "UserAccessOverride"("componentName");

ALTER TABLE "UserAccessOverride" ADD CONSTRAINT IF NOT EXISTS "UserAccessOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

5. Click **"Run"** button
6. Done! ✅

This creates the table without needing Prisma migrations.

