# 🔧 Fix: Vercel Database Error

## ❌ The Problem

**Error:** `Error code 14: Unable to open the database file`

**Cause:** Your schema is set to SQLite, but Vercel's serverless functions don't support SQLite file databases. They need PostgreSQL.

---

## ✅ The Solution

You need to:

1. **Switch schema back to PostgreSQL** (I've done this for you)
2. **Set environment variables in Vercel**
3. **Run migrations on your production database**

---

## 📋 Step-by-Step Fix

### Step 1: Schema is Now Fixed ✅

I've already updated:
- `prisma/schema.prisma` → Back to PostgreSQL
- `prisma/migrations/migration_lock.toml` → Back to PostgreSQL

### Step 2: Set Environment Variables in Vercel

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Click on your project: `nextjs-auth-roles`
   - Go to **Settings** → **Environment Variables**

2. **Add These Variables** (for Production, Preview, and Build):

   ```
   DATABASE_URL = your-postgresql-connection-string
   DIRECT_URL = your-postgresql-direct-connection-string
   ```

   **Where to get these:**
   - If using **Supabase**: 
     - Go to Project Settings → Database
     - Copy "Connection string" (Pooler) → `DATABASE_URL`
     - Copy "Connection string" (Direct) → `DIRECT_URL`
   
   - If using **Vercel Postgres**:
     - Go to Storage → Your database
     - Copy connection strings
   
   - If using **Neon/Railway/etc**:
     - Check your database dashboard for connection strings

3. **Also Make Sure These Are Set:**
   ```
   NEXTAUTH_URL = https://nextjs-auth-roles.vercel.app
   NEXTAUTH_SECRET = your-secret-key
   ```

### Step 3: Run Migrations on Production Database

After setting environment variables, you need to run migrations:

**Option A: Using Vercel CLI (Recommended)**

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login
vercel login

# Pull environment variables
vercel env pull .env.local

# Run migrations
npx prisma migrate deploy
```

**Option B: Using Supabase/Your Database Provider**

1. Connect to your PostgreSQL database
2. Run the migration SQL manually (from `prisma/migrations/`)

**Option C: Create Temporary Migration Route**

Create `app/api/migrate/route.ts` (temporary, delete after use):

```typescript
import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET() {
  try {
    await execAsync("npx prisma migrate deploy");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

Then visit: `https://your-app.vercel.app/api/migrate` once, then delete the file.

### Step 4: Commit and Push

```bash
git add prisma/schema.prisma prisma/migrations/migration_lock.toml
git commit -m "Switch to PostgreSQL for Vercel deployment"
git push
```

### Step 5: Verify

1. Wait for Vercel to rebuild
2. Check logs - should no longer show database errors
3. Test login/registration

---

## 🏠 Local Development Options

Now that production uses PostgreSQL, you have two options for local development:

### Option A: Use PostgreSQL Locally (Recommended)

1. **Get a free PostgreSQL database:**
   - [Supabase](https://supabase.com) - Free tier
   - [Neon](https://neon.tech) - Free tier
   - [Railway](https://railway.app) - Free tier

2. **Create `.env` file:**
   ```env
   DATABASE_URL=your-postgresql-connection-string
   DIRECT_URL=your-postgresql-direct-connection-string
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-local-secret
   ```

3. **Run migrations:**
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

### Option B: Switch Between SQLite and PostgreSQL

**For Local Development (SQLite):**
- Manually change `prisma/schema.prisma` to SQLite
- Use `npx prisma db push` for local changes

**For Production (PostgreSQL):**
- Keep schema as PostgreSQL
- Use environment variables in Vercel

⚠️ **Note:** This requires switching the schema file before each commit, which is error-prone.

---

## ✅ Quick Checklist

- [ ] Schema switched to PostgreSQL ✅ (Done)
- [ ] Migration lock updated ✅ (Done)
- [ ] Set `DATABASE_URL` in Vercel
- [ ] Set `DIRECT_URL` in Vercel
- [ ] Run migrations on production database
- [ ] Commit and push changes
- [ ] Verify Vercel deployment works

---

## 🆘 Still Having Issues?

1. **Check Vercel Logs:**
   - Go to your deployment → Logs tab
   - Look for specific error messages

2. **Verify Environment Variables:**
   - Make sure they're set for **Production, Preview, AND Build**
   - Check that connection strings are correct

3. **Test Database Connection:**
   - Try connecting to your database from your local machine
   - Verify credentials are correct

4. **Check Prisma Client:**
   - Make sure `npx prisma generate` runs during build
   - Check build logs for Prisma errors

---

## 📚 Resources

- **Vercel Environment Variables:** https://vercel.com/docs/concepts/projects/environment-variables
- **Prisma with Vercel:** https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel
- **Supabase Setup:** https://supabase.com/docs/guides/getting-started

---

**After fixing, your Vercel deployment should work!** 🎉

