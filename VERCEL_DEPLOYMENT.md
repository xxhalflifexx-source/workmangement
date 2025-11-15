# Vercel Deployment Guide

## Prerequisites

1. **PostgreSQL Database**: You'll need a PostgreSQL database. Recommended options:
   - [Vercel Postgres](https://vercel.com/storage/postgres) (easiest integration)
   - [Neon](https://neon.tech/) (free tier available)
   - [Supabase](https://supabase.com/) (free tier available)
   - [Railway](https://railway.app/) (free tier available)

2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)

3. **Resend Account**: For email functionality, sign up at [resend.com](https://resend.com)

## Step 1: Set up PostgreSQL Database

### Option A: Vercel Postgres (Recommended)
1. Go to your Vercel dashboard
2. Navigate to Storage → Create Database → Postgres
3. Create a new database
4. Copy the connection string

### Option B: External Database
1. Sign up for a PostgreSQL provider (Neon, Supabase, etc.)
2. Create a new database
3. Copy the connection string

## Step 2: Install Vercel CLI

```bash
npm i -g vercel
```

## Step 3: Deploy to Vercel

1. **Login to Vercel**:
   ```bash
   vercel login
   ```

2. **Deploy your project**:
   ```bash
   vercel
   ```

3. **Set Environment Variables** in Vercel Dashboard:
   - Go to your project → Settings → Environment Variables
   - Add the following variables:
     - `DATABASE_URL`: Your PostgreSQL connection string
     - `NEXTAUTH_URL`: Your Vercel app URL (e.g., https://your-app.vercel.app)
     - `NEXTAUTH_SECRET`: Generate a random secret (use `openssl rand -base64 32`)
     - `RESEND_API_KEY`: Your Resend API key

## Step 4: Run Database Migrations

After deployment, you need to run Prisma migrations:

1. **Option A: Using Vercel CLI**:
   ```bash
   vercel env pull .env.local
   npx prisma migrate deploy
   npx prisma db seed
   ```

2. **Option B: Using Vercel Functions**:
   Create a temporary API route to run migrations (remove after use)

## Step 5: Verify Deployment

1. Visit your deployed app URL
2. Test user registration and login
3. Check that database operations work correctly

## Troubleshooting

### Common Issues:

1. **Database Connection Errors**:
   - Ensure DATABASE_URL is correctly set
   - Check that your database allows connections from Vercel IPs

2. **Build Failures**:
   - Check that all environment variables are set
   - Ensure Prisma client is generated during build

3. **Authentication Issues**:
   - Verify NEXTAUTH_URL matches your deployment URL
   - Ensure NEXTAUTH_SECRET is set

### Useful Commands:

```bash
# Check deployment logs
vercel logs

# Redeploy with latest changes
vercel --prod

# Pull environment variables locally
vercel env pull .env.local
```

## Production Checklist

- [ ] PostgreSQL database set up and accessible
- [ ] All environment variables configured in Vercel
- [ ] Database migrations run successfully
- [ ] Email functionality working (if using Resend)
- [ ] Authentication flow tested
- [ ] All features working in production
- [ ] Custom domain configured (optional)

