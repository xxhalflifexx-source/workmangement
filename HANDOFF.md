## Project Handoff Guide

This document equips a new developer to run, develop, and deploy the app.

### Overview
- Framework: Next.js 14 (App Router), TypeScript, Tailwind
- Auth: NextAuth (JWT) + Prisma (Postgres)
- DB: Supabase Postgres (migrations via Prisma)
- Storage: Supabase Storage (`uploads` bucket, public)
- Email: Resend (optional; used for verification)

### Live URLs
- Production: https://nextjs-auth-roles.vercel.app
- Vercel Project: shared via Vercel dashboard
- Supabase Project: shared via Supabase dashboard

### Access to transfer
- Vercel: Project access (Owner/Developer) and Git integration
- Supabase: Project access (DB + Storage)
- Resend: API access if email verification will be used in non-dev

### Environment variables (Vercel: Production, Preview, and Build)
- NEXTAUTH_URL = https://nextjs-auth-roles.vercel.app
- NEXTAUTH_SECRET = 32-byte secure secret
- DATABASE_URL = Supabase pooled connection string (Pooler)
- DIRECT_URL = Supabase direct connection string
- SUPABASE_URL = your Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY = Supabase service role key
- SUPABASE_BUCKET = uploads
- RESEND_API_KEY = your Resend API key (optional)
- DEV_BYPASS_AUTH = "true" (optional; use for local dev only)

See `ENV.EXAMPLE` in the repo for a sanitized template (copy to `.env`).

### Local development
1) Clone and install
   - `npm install`
2) Copy envs
   - `cp .env.example .env`
   - Fill with your Supabase DB, Supabase project keys, and a dev `NEXTAUTH_SECRET`
3) Migrate and seed
   - `npx prisma migrate dev`
   - `npx prisma db seed`
4) Run
   - `npm run dev`
5) Optional (emails)
   - Add `RESEND_API_KEY` to send verification emails. Without it, the app skips sending.

### Deploy (Vercel + Supabase)
1) Ensure Supabase project exists
   - Copy Pooler `DATABASE_URL` and `DIRECT_URL`
   - Create public Storage bucket `uploads`
2) Vercel env vars
   - Add all envs listed above (Production, Preview, and Build)
3) Deploy
   - Push to main or trigger a deployment in Vercel
   - Build runs `prisma migrate deploy` automatically

### Operational details
- Auth
  - Credentials login with email verification required
  - Seeded test users are pre-verified
- Route protection
  - `middleware.ts` protects `/dashboard`, `/jobs`, `/time-clock`, `/inventory`, `/admin`, `/invoices`, `/finance`, `/hr`
  - For local dev, set `DEV_BYPASS_AUTH="true"`
- Storage
  - `app/api/upload/route.ts` uploads to Supabase Storage and returns public URLs
  - Bucket name defaults to `uploads` (configurable via `SUPABASE_BUCKET`)
- Prisma / Migrations
  - Prisma targets Postgres (Supabase)
  - Build script: `prisma generate && prisma migrate deploy && next build`
  - Local: use `npx prisma migrate dev` and `npx prisma db seed`
- Emails
  - `lib/email.ts` integrates with Resend
  - Without a valid `RESEND_API_KEY`, sending is skipped (safe for dev)

### Scripts (see `scripts/`)
- `create-admin.ts`, `update-user-role.ts`, `clear-users.ts`, `verify-existing-users.ts`, etc.
- Run with: `tsx scripts/<script>.ts`

### Troubleshooting
- Uploads 500
  - Missing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / bucket not public
- Login blocked
  - Email verification required; either set `RESEND_API_KEY` or use seeded accounts
- Prisma errors on deploy
  - Ensure `DATABASE_URL` and `DIRECT_URL` exist in Vercel build env
- Auth bypass in dev
  - Set `DEV_BYPASS_AUTH="true"` for local only

### Next steps / backlog (suggested)
- Add resend verification code feature
- Add password reset
- Add role-specific dashboards
- Add rate limiting on auth endpoints

### Contact
Include a point of contact and access transfer notes in your handover email or ticket.


