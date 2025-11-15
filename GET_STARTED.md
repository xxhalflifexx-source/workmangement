# Getting Started - Connecting to Your Boss's Project

This guide will help you connect this local copy of the project to the Vercel and Supabase setup that your boss created.

## What You Need From Your Boss

Ask your boss for the following information to connect to the project:

### 1. Supabase Credentials
- **Supabase Project URL**: Looks like `https://xxxxx.supabase.co`
- **Supabase Service Role Key**: A long secret key (starts with `eyJ...`)
- **Database Connection Strings**:
  - **DATABASE_URL** (Pooler): Connection string for the pooled connection
  - **DIRECT_URL**: Direct connection string for migrations

**How to get these:**
1. Go to Supabase Dashboard → Your Project
2. Go to **Settings** → **Database**
3. Find "Connection string" section
4. Copy the "Transaction Pooler" connection string → This is your `DATABASE_URL`
5. Copy the "Direct connection" string → This is your `DIRECT_URL`
6. Go to **Settings** → **API**
7. Copy the "Project URL" → This is your `SUPABASE_URL`
8. Copy the "service_role" key (keep it secret!) → This is your `SUPABASE_SERVICE_ROLE_KEY`

### 2. Vercel Information (Optional - for pulling environment variables)
- **Vercel Project Name** or **URL**
- Access to the Vercel dashboard (or ask your boss to export environment variables)

**Alternative:** If you have Vercel CLI access, you can pull environment variables:
```bash
npm install -g vercel
vercel login
vercel link  # Link to the project
vercel env pull .env.local  # Pull environment variables
```

### 3. Other Credentials (Optional)
- **NEXTAUTH_SECRET**: A secret key for authentication (your boss can generate a new one for you)
- **RESEND_API_KEY**: Only if email verification is needed (optional for local development)

## Step-by-Step Setup

### Step 1: Update Your .env File

Open the `.env` file in the project root and replace the placeholder values with the actual credentials from your boss:

```env
# Runtime URLs
NEXTAUTH_URL=http://localhost:3000  # Use localhost for local development

# Secrets
NEXTAUTH_SECRET=your-boss-provided-secret-or-generate-new-one

# Database (Supabase Postgres)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.supabase.com:5432/postgres

# Supabase (Storage + Project URL)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_BUCKET=uploads

# Email (Resend) - optional in dev
RESEND_API_KEY=your-resend-key-if-needed

# Development helpers (local only)
DEV_BYPASS_AUTH=true
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Database

Generate Prisma Client and run migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

**Note:** This will connect to your boss's Supabase database. Make sure you have the correct credentials first!

### Step 4: (Optional) Seed Test Data

If you want to add test users:

```bash
npx prisma db seed
```

### Step 5: Run the Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your app!

## Connecting to Git Repository (Optional)

If your boss has the project in a Git repository (GitHub, GitLab, etc.), you can connect to it:

### Option 1: Clone the Original Repository
```bash
# If you want to start fresh from the original
git clone <repository-url> .
```

### Option 2: Add Remote to Current Project
```bash
# Initialize git if not already done
git init

# Add the original repository as a remote
git remote add origin <repository-url>

# Pull the latest changes
git pull origin main
```

**Note:** Since this is a copy, you might want to work on a separate branch:
```bash
git checkout -b my-feature-branch
```

## Troubleshooting

### "Cannot connect to database"
- Double-check your `DATABASE_URL` and `DIRECT_URL` in `.env`
- Make sure the Supabase project is active and accessible
- Verify the connection strings are correct (they're case-sensitive)

### "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
- Make sure you've added these to your `.env` file
- Check that there are no extra spaces or quotes around the values

### "Prisma Client not generated"
- Run `npx prisma generate` manually

### "Migration failed"
- Make sure `DIRECT_URL` is set correctly (migrations use direct connection)
- Check that you have the right permissions on the Supabase database

## Important Notes

1. **This is a copy** - Your changes won't affect the original project unless you push to the same repository
2. **Database is shared** - If you're using the same Supabase database, your changes will affect the live data (be careful!)
3. **Environment variables** - Never commit your `.env` file to git (it should be in `.gitignore`)

## Next Steps

Once you have everything set up:
1. Test the connection by running `npm run dev`
2. Try logging in or registering a user
3. Test file uploads (they should go to Supabase Storage)
4. Start making your changes!

## Need Help?

If you're stuck, ask your boss for:
- Access to the Supabase dashboard
- Access to the Vercel dashboard
- The Git repository URL (if applicable)
- Any specific setup instructions they have

