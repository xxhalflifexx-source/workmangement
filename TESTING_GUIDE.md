# Testing Guide - Local Development & Vercel Deployments

## 🧪 Testing Options

You have **three ways** to test your changes:

### 1. **Local Development (Recommended for Quick Testing)**
Test on your computer before deploying anywhere.

### 2. **Vercel Preview Deployments (Test Before Production)**
Test on a live URL that's separate from production.

### 3. **Production (Live Site)**
The actual live site that users see.

---

## 🖥️ Option 1: Local Development (Best for Development)

### How It Works
- Run the app on your computer at `http://localhost:3000`
- **Fast** - Changes appear instantly
- **Safe** - Doesn't affect the live site
- **Free** - No deployment needed

### Setup Steps

1. **Make sure dependencies are installed:**
   ```bash
   npm install
   ```

2. **Set up your `.env` file** with credentials from your boss (see `GET_STARTED.md`)

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   - Go to `http://localhost:3000`
   - You'll see the app running locally!

### Advantages
- ✅ Instant feedback (changes appear immediately)
- ✅ No deployment time
- ✅ Can test without internet (after initial setup)
- ✅ Safe - won't break production

### Disadvantages
- ❌ Only you can access it (localhost only)
- ❌ Need database credentials to test database features

---

## 🌐 Option 2: Vercel Preview Deployments (Test Before Production)

### How It Works
- When you push code to a branch, Vercel automatically creates a **preview URL**
- This is a **separate copy** of your app for testing
- Production stays untouched until you merge to main

### Setup Steps

1. **Connect to Git Repository:**
   ```bash
   git init
   git remote add origin <your-boss-repo-url>
   git checkout -b my-test-branch
   ```

2. **Push your changes:**
   ```bash
   git add .
   git commit -m "My test changes"
   git push origin my-test-branch
   ```

3. **Vercel automatically creates a preview:**
   - Go to Vercel Dashboard
   - You'll see a new "Preview Deployment"
   - Click it to get a unique URL like: `https://your-app-git-my-test-branch.vercel.app`

### Advantages
- ✅ **Real URL** - Share with others for testing
- ✅ **Separate from production** - Safe to test
- ✅ **Automatic** - Happens when you push code
- ✅ **Can test on mobile/tablet** - Real device testing

### Disadvantages
- ⏱️ Takes 2-5 minutes to deploy
- 🌐 Requires internet connection

---

## 🚀 Option 3: Production (Live Site)

### How It Works
- The actual live site that users see
- Updates when you push to the `main` branch (or merge a PR)

### Important Notes
- ⚠️ **Changes go live immediately** - Be careful!
- ✅ **You CAN still edit after publishing** - Just push new changes
- ✅ **Vercel auto-deploys** - Every push to main = new deployment

### Workflow Recommendation

**Best Practice:**
1. **Develop locally** → Test on `localhost:3000`
2. **Create a branch** → `git checkout -b feature-name`
3. **Push to branch** → Get preview URL for testing
4. **Test preview** → Make sure everything works
5. **Merge to main** → Deploys to production

---

## 🔧 Quick Start: Testing Locally Right Now

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Check Your .env File
Make sure you have these set (get values from your boss):
- `DATABASE_URL` - Supabase database connection
- `DIRECT_URL` - Supabase direct connection
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service key
- `NEXTAUTH_SECRET` - Generate one: `openssl rand -base64 32`
- `NEXTAUTH_URL` - Set to `http://localhost:3000` for local dev

### Step 3: Generate Prisma Client
```bash
npx prisma generate
```

### Step 4: Run Development Server
```bash
npm run dev
```

### Step 5: Open Browser
Go to: **http://localhost:3000**

---

## 🐛 Troubleshooting Connection Errors

### "Cannot connect to database"
**Cause:** Missing or incorrect database credentials

**Solution:**
1. Check your `.env` file has `DATABASE_URL` and `DIRECT_URL`
2. Verify the connection strings from Supabase are correct
3. Make sure the Supabase project is active

### "Missing SUPABASE_URL"
**Cause:** Supabase credentials not set

**Solution:**
1. Get `SUPABASE_URL` from Supabase Dashboard → Settings → API
2. Get `SUPABASE_SERVICE_ROLE_KEY` from same page
3. Add both to your `.env` file

### "Prisma Client not generated"
**Cause:** Prisma Client needs to be generated

**Solution:**
```bash
npx prisma generate
```

### "Port 3000 already in use"
**Cause:** Another app is using port 3000

**Solution:**
```bash
# Use a different port
npm run dev -- -p 3001
```

---

## 📋 Testing Checklist

Before pushing to production, test:

- [ ] **Authentication** - Can you login/register?
- [ ] **Database** - Do data operations work?
- [ ] **File Uploads** - Can you upload images?
- [ ] **Protected Routes** - Are routes properly secured?
- [ ] **Role Permissions** - Do different roles work correctly?
- [ ] **Mobile View** - Does it look good on phone?
- [ ] **No Console Errors** - Check browser console

---

## 🎯 Recommended Workflow

### For Daily Development:
```
1. Work locally (localhost:3000)
   ↓
2. Test your changes
   ↓
3. Commit to a branch
   ↓
4. Push → Get preview URL
   ↓
5. Test preview with team/boss
   ↓
6. Merge to main → Production
```

### Quick Local Testing:
```
npm run dev → http://localhost:3000
```

---

## 💡 Pro Tips

1. **Use Preview Deployments** - Always test on preview before production
2. **Keep Production Safe** - Only merge tested code to main branch
3. **Local First** - Develop and test locally, then deploy
4. **Environment Variables** - Make sure all env vars are set in Vercel too
5. **Database Migrations** - Run `npx prisma migrate deploy` after schema changes

---

## ❓ FAQ

**Q: Can I edit after publishing?**
A: Yes! Just push new changes. Vercel will redeploy automatically.

**Q: Will my changes break the live site?**
A: Not if you use preview deployments first! Test on preview, then merge to production.

**Q: How do I test without affecting production?**
A: Use local development or create a preview deployment from a branch.

**Q: What if I make a mistake in production?**
A: You can quickly push a fix, or revert the deployment in Vercel dashboard.

**Q: Do I need internet to test locally?**
A: Only for the initial setup and database connection. After that, you can work offline (but database features need internet).

---

## 🚀 Next Steps

1. **Get credentials from your boss** (see `GET_STARTED.md`)
2. **Set up `.env` file** with those credentials
3. **Run `npm install`** if you haven't
4. **Run `npm run dev`** to start local testing
5. **Visit `http://localhost:3000`** to see your app!

