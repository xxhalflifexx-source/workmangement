# 🚀 Quick Start - Test Your App Locally

## Step 1: Get Credentials From Your Boss

You need these from your boss to connect to the Supabase database:

1. **Supabase Project URL** - Looks like `https://xxxxx.supabase.co`
2. **Supabase Service Role Key** - A long secret key
3. **Database Connection Strings**:
   - `DATABASE_URL` (Pooler connection)
   - `DIRECT_URL` (Direct connection)

**Where to find them:**
- Supabase Dashboard → Settings → Database → Connection strings
- Supabase Dashboard → Settings → API → Project URL & Service Role Key

## Step 2: Update Your .env File

Open `.env` in the project root and add the credentials:

```env
# For local development
NEXTAUTH_URL=http://localhost:3000

# Generate a secret (run: openssl rand -base64 32)
NEXTAUTH_SECRET=your-generated-secret-here

# From your boss - Supabase Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.supabase.com:5432/postgres

# From your boss - Supabase Storage
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_BUCKET=uploads

# Optional - for email verification
RESEND_API_KEY=your-resend-key-if-needed

# Local development helper
DEV_BYPASS_AUTH=true
```

## Step 3: Start the Development Server

```bash
npm run dev
```

## Step 4: Open Your Browser

Go to: **http://localhost:3000**

You should see the app running! 🎉

---

## 🔍 Testing Your Boss's App

### Option A: Test Locally (Recommended)
1. Get credentials from your boss
2. Update `.env` file
3. Run `npm run dev`
4. Visit `http://localhost:3000`

### Option B: Test the Live Site
- Ask your boss for the Vercel URL
- Visit it in your browser
- You can see what's currently live

### Option C: Test on Preview Deployment
- Create a branch and push to Git
- Vercel will create a preview URL
- Test there before affecting production

---

## ❓ Common Connection Errors

### "Cannot connect to database"
**Fix:** Make sure `DATABASE_URL` and `DIRECT_URL` in `.env` are correct

### "Missing SUPABASE_URL"
**Fix:** Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env`

### "Prisma Client not generated"
**Fix:** Run `npx prisma generate`

---

## ✅ You Can Edit After Publishing!

**Yes!** You can always edit and update the live site:

1. **Make changes locally**
2. **Test on `localhost:3000`**
3. **Push to Git** → Vercel auto-deploys
4. **Changes go live** in 2-5 minutes

**Best Practice:** Test on a preview deployment first, then merge to production.

---

## 📝 Next Steps

1. ✅ Dependencies installed
2. ✅ Prisma Client generated
3. ⏳ Get credentials from boss
4. ⏳ Update `.env` file
5. ⏳ Run `npm run dev`
6. ⏳ Test at `http://localhost:3000`

See `TESTING_GUIDE.md` for more detailed information!

