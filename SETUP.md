# Quick Setup Guide

## Step-by-Step Installation

### 1. Install Node Modules

```bash
npm install
```

Expected packages:
- next, react, react-dom
- next-auth, @auth/prisma-adapter
- @prisma/client, prisma
- bcrypt, @types/bcrypt
- zod
- tailwindcss, postcss
- typescript, ts-node

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Generate a secure secret:

```bash
openssl rand -base64 32
```

Update `.env` with your generated secret:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="paste-your-generated-secret-here"
```

### 3. Initialize Database

Create the database schema:

```bash
npx prisma migrate dev --name init
```

This will:
- Create `prisma/dev.db` (SQLite database)
- Apply the schema migrations
- Generate the Prisma Client

If you see "Prisma Client not generated", run:

```bash
npx prisma generate
```

### 4. Seed Test Users

Populate the database with test users:

```bash
npx prisma db seed
```

**Test Credentials:**
- **Admin**: admin@example.com / Passw0rd!
- **Manager**: manager@example.com / Passw0rd!
- **Employee**: employee@example.com / Passw0rd!

### 5. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

## Testing the Application

### Test Authentication Flow

1. **Home Page** (http://localhost:3000)
   - Click "Register" or "Login"

2. **Register a New User** (http://localhost:3000/register)
   - Enter: Name, Email, Password (min 6 chars)
   - Default role: EMPLOYEE
   - Redirects to login after success

3. **Login** (http://localhost:3000/login)
   - Use seeded credentials or your new account
   - Redirects to dashboard after success

4. **Dashboard** (http://localhost:3000/dashboard)
   - Shows: Name, Email, Role, User ID
   - Protected route (requires authentication)

5. **Sign Out**
   - Click "Sign Out" button
   - Returns to home page

### Test Route Protection

Try accessing `/dashboard` without logging in:
```
http://localhost:3000/dashboard
```
→ Should redirect to `/login`

### Test Role Access

All these routes are protected by middleware:
- http://localhost:3000/dashboard
- http://localhost:3000/jobs (will show 404 but requires auth)
- http://localhost:3000/admin (will show 404 but requires auth)

## Verification Checklist

- [ ] `npm install` completed successfully
- [ ] `.env` file created with valid `NEXTAUTH_SECRET`
- [ ] `npx prisma migrate dev` created `dev.db`
- [ ] `npx prisma db seed` added 3 test users
- [ ] `npm run dev` starts without errors
- [ ] Can access home page at localhost:3000
- [ ] Can register a new user
- [ ] Can login with test credentials
- [ ] Dashboard shows user info and role
- [ ] Accessing `/dashboard` while logged out redirects to `/login`
- [ ] Sign out works and returns to home

## Common Issues

### Issue: "npm not found" or "command not recognized"

**Solution**: Install Node.js from https://nodejs.org/ (LTS version recommended)

### Issue: "Cannot find module '@prisma/client'"

**Solution**: 
```bash
npx prisma generate
npm install
```

### Issue: Database migration fails

**Solution**: Delete `prisma/dev.db` and re-run:
```bash
npx prisma migrate dev --name init
```

### Issue: TypeScript errors about session type

**Solution**: Restart your TypeScript server or VS Code. The `types/next-auth.d.ts` file extends the session type.

### Issue: Middleware not protecting routes

**Solution**: Ensure `middleware.ts` is in the project root (same level as `app/` directory), not inside `app/`.

## Next Steps

- Add email verification
- Implement password reset
- Add profile page
- Create role-specific pages (admin panel, manager dashboard)
- Add rate limiting to login attempts
- Set up proper logging
- Deploy to Vercel or similar platform

## Production Deployment

Before deploying to production:

1. **Change Database** from SQLite to PostgreSQL:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Generate New Secret**:
   ```bash
   openssl rand -base64 32
   ```

3. **Set Environment Variables** on your hosting platform

4. **Run Migrations**:
   ```bash
   npx prisma migrate deploy
   ```

5. **Build Application**:
   ```bash
   npm run build
   ```

## Deploy to Vercel + Supabase (Postgres + Storage)

Follow these steps to launch on Vercel using Supabase for the database and file storage.

### 1) Create Supabase project

- Create a new project in Supabase.
- Go to Project Settings → Database and copy both connection strings:
  - DATABASE_URL (Pooler) → use for `DATABASE_URL`
  - Direct connection → use for `DIRECT_URL`

### 2) Create Storage bucket

- Go to Storage → Create bucket named `uploads`
- Make the bucket Public (so returned image URLs are viewable)

### 3) Configure Vercel project

- Import this repo into Vercel (framework: Next.js).
- In Vercel → Settings → Environment Variables, add the following for Production (and Preview as needed):
  - NEXTAUTH_URL = https://your-vercel-domain.vercel.app
  - NEXTAUTH_SECRET = generate a new 32-byte secret
  - DATABASE_URL = Supabase pooled connection string (Pooler)
  - DIRECT_URL = Supabase direct connection string
  - RESEND_API_KEY = your Resend API key (optional, enables email verification)
  - SUPABASE_URL = your Supabase project URL
  - SUPABASE_SERVICE_ROLE_KEY = your Supabase service role key
  - SUPABASE_BUCKET = uploads

Notes:
- The build script runs `prisma migrate deploy` automatically, so `DATABASE_URL`/`DIRECT_URL` must be set for the Build environment too.
- Email verification requires `RESEND_API_KEY`. Without it, sending is skipped and users cannot receive the code.

### 4) Trigger deployment

- Push to the main branch or click “Deploy” in Vercel.
- Verify logs show Prisma migrations applied and the Next.js build succeeded.

### 5) Post-deploy checks

- Visit the app URL and register a new user; check your inbox if email verification is enabled.
- Test login, protected routes, and try uploading images (they should return public Supabase Storage URLs).

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)



