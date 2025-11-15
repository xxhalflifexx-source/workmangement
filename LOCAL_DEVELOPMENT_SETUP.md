# 🏠 Local Development Setup (No Production Credentials Needed)

If you can't get production credentials right away, you can still develop locally using a local database!

---

## 🎯 Quick Setup: Use Local SQLite Database

This lets you develop and test without needing production database access.

### Step 1: Update Prisma Schema

1. Open `prisma/schema.prisma`
2. Change the datasource to SQLite:

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}
```

3. **Remove** the `directUrl` line (SQLite doesn't need it)
4. Save the file

### Step 2: Update .env File

Open `.env` and set:

```env
# Local development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=ugQJ2i7RuvwkBVQ17hQffO21W9yDYK1A9A5wFlXzpuU=

# Local SQLite database
DATABASE_URL="file:./dev.db"

# Supabase - Leave as placeholders for now (file uploads won't work)
SUPABASE_URL=https://placeholder.supabase.co
SUPABASE_SERVICE_ROLE_KEY=placeholder
SUPABASE_BUCKET=uploads

# Development helper
DEV_BYPASS_AUTH=true
```

### Step 3: Create Database

```bash
npx prisma migrate dev --name init
```

This will:
- Create `prisma/dev.db` (local database file)
- Run all migrations
- Generate Prisma Client

### Step 4: Seed Test Data (Optional)

```bash
npx prisma db seed
```

This creates test users you can login with.

### Step 5: Start Development Server

```bash
npm run dev
```

Visit: **http://localhost:3000**

**Everything works!** 🎉

---

## ✅ What Works with Local Database

- ✅ User registration
- ✅ User login
- ✅ All database operations
- ✅ Protected routes
- ✅ Role-based access
- ✅ All features that use database

## ❌ What Won't Work

- ❌ File uploads (needs Supabase Storage)
- ❌ Email verification (needs Resend API key)

**But that's fine!** You can develop and test most features.

---

## 🔄 Later: Switch to Production Database

When you get production credentials:

1. **Change `prisma/schema.prisma` back to PostgreSQL:**
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```

2. **Update `.env`** with production credentials

3. **Run:**
   ```bash
   npx prisma generate
   npx prisma db pull
   ```

4. **Everything connects to production!**

---

## 🎯 Alternative: Create Free Supabase Project

If you want to test with a real PostgreSQL database (but separate from production):

### Step 1: Create Supabase Account

1. Go to **https://supabase.com**
2. Sign up (free tier available)
3. Create a new project

### Step 2: Get Credentials

1. Go to **Settings** → **Database**
2. Copy connection strings
3. Go to **Settings** → **API**
4. Copy Project URL and Service Role Key

### Step 3: Create Storage Bucket

1. Go to **Storage**
2. Create bucket named `uploads`
3. Make it **Public**

### Step 4: Update .env

Use the new Supabase credentials in your `.env` file.

**Now you have:**
- Real PostgreSQL database
- File uploads working
- Separate from production (safe to test)

---

## 📋 Recommended Approach

**For now:**
1. Use local SQLite (fastest setup)
2. Develop and test features
3. Get production credentials from boss later

**When you get production credentials:**
1. Switch to production database
2. Test with real data
3. Deploy improvements

---

## 🚀 Quick Start Commands

```bash
# Setup local database
npx prisma migrate dev --name init

# Seed test data
npx prisma db seed

# Start development
npm run dev
```

---

## 💡 Pro Tips

1. **Local SQLite is fast** - Perfect for development
2. **No internet needed** - After initial setup
3. **Safe to experiment** - Won't affect production
4. **Easy to reset** - Just delete `prisma/dev.db` and re-run migrations

---

## ✅ You Can Start Developing Now!

Even without production credentials, you can:
- ✅ Write code
- ✅ Test features
- ✅ See how everything works
- ✅ Make improvements

**Get production credentials later** when you're ready to test with real data or deploy!

---

**Next step:** Follow the "Quick Setup" above to get started in 5 minutes! 🚀

