# Next.js Authentication with Role-Based Access Control

A complete authentication system built with Next.js App Router, NextAuth.js (Auth.js), Prisma, and SQLite featuring role-based access control.

## Features

✅ **Email + Password Authentication** (Credentials provider)  
✅ **Three User Roles**: EMPLOYEE, MANAGER, ADMIN  
✅ **Secure Password Hashing** with bcrypt  
✅ **Role-Gated Routes** with middleware  
✅ **Server Actions** for registration  
✅ **TypeScript** for type safety  
✅ **Prisma ORM** with SQLite database  
✅ **Tailwind CSS** for styling  

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Authentication**: NextAuth.js v4
- **Database**: Prisma + SQLite
- **Validation**: Zod
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Project Structure

```
nextjs-auth-roles/
├── app/
│   ├── (auth)/
│   │   └── actions.ts           # Server actions for registration
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts     # NextAuth API route
│   ├── dashboard/
│   │   └── page.tsx             # Protected dashboard
│   ├── login/
│   │   └── page.tsx             # Login page
│   ├── register/
│   │   └── page.tsx             # Registration page
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                 # Home page
├── lib/
│   ├── authOptions.ts           # NextAuth configuration
│   ├── prisma.ts                # Prisma client singleton
│   └── roles.ts                 # Role-based helpers
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── seed.ts                  # Seed script for test users
├── types/
│   └── next-auth.d.ts           # NextAuth type extensions
├── middleware.ts                # Route protection middleware
├── .env                         # Environment variables (local)
├── .env.example                 # Environment template
└── package.json
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

**Generate a secure NEXTAUTH_SECRET:**

```bash
openssl rand -base64 32
```

Update your `.env` file with the generated secret:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-secret-here"
```

### 3. Initialize Database

Run Prisma migrations to create the database:

```bash
npx prisma migrate dev --name init
```

Generate Prisma Client:

```bash
npx prisma generate
```

### 4. Seed Test Users

```bash
npx prisma db seed
```

This creates three test users:

| Email                    | Password   | Role     |
|--------------------------|------------|----------|
| admin@example.com        | Passw0rd!  | ADMIN    |
| manager@example.com      | Passw0rd!  | MANAGER  |
| employee@example.com     | Passw0rd!  | EMPLOYEE |

### 5. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

### Authentication Flow

1. **Register**: Visit `/register` to create a new account (defaults to EMPLOYEE role)
2. **Login**: Visit `/login` to sign in with email and password
3. **Dashboard**: After login, you'll be redirected to `/dashboard`
4. **Sign Out**: Click the "Sign Out" button on the dashboard

### Protected Routes

The following routes are protected by middleware and require authentication:

- `/dashboard/*`
- `/jobs/*`
- `/time-clock/*`
- `/inventory/*`
- `/admin/*`
- `/hr/*`

Unauthenticated users will be redirected to `/login`.

### Role-Based Access Control

#### Server-Side Role Checking

Use the helper functions in server components or server actions:

```typescript
import { requireAuth, assertRole } from "@/lib/roles";

// Require authentication
const session = await requireAuth();

// Require MANAGER or higher
await assertRole("MANAGER");

// Require ADMIN only
await assertRole("ADMIN");
```

#### Client-Side Session Access

```typescript
"use client";
import { useSession } from "next-auth/react";

export default function Component() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  
  return <div>Role: {userRole}</div>;
}
```

## API Routes

### NextAuth Endpoints

- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/session` - Get current session
- `GET /api/auth/csrf` - Get CSRF token

## Database Schema

### User Model

```prisma
model User {
  id           String    @id @default(cuid())
  name         String?
  email        String?   @unique
  phone        String?
  passwordHash String?
  role         Role      @default(EMPLOYEE)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  accounts     Account[]
  sessions     Session[]
}
```

### Role Enum

```prisma
enum Role {
  EMPLOYEE
  MANAGER
  ADMIN
}
```

## Prisma Commands

```bash
# Create and apply a migration
npx prisma migrate dev --name migration_name

# Generate Prisma Client
npx prisma generate

# Seed the database
npx prisma db seed

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (careful - deletes all data!)
npx prisma migrate reset
```

## Security Notes

- ✅ Passwords are hashed with bcrypt (10 rounds)
- ✅ JWT strategy for sessions
- ✅ CSRF protection enabled by default
- ✅ Input validation with Zod
- ✅ Never store plaintext passwords
- ⚠️ Change `NEXTAUTH_SECRET` in production
- ⚠️ Use strong passwords
- ⚠️ Consider adding rate limiting
- ⚠️ Add email verification for production

## Acceptance Criteria

✅ Visiting `/dashboard` while signed out redirects to `/login`  
✅ Register page creates a user with default EMPLOYEE role  
✅ Login with seeded users works correctly  
✅ Dashboard displays user name and role  
✅ `middleware.ts` protects the listed routes  
✅ Server actions can call `assertRole()` to gate logic  
✅ No plaintext passwords stored (only `passwordHash`)  
✅ Type-safe session with role information  

## Customization

### Add More Roles

1. Update `prisma/schema.prisma`:
   ```prisma
   enum Role {
     EMPLOYEE
     MANAGER
     ADMIN
     SUPER_ADMIN  // New role
   }
   ```

2. Update `types/next-auth.d.ts` to include the new role

3. Run migration:
   ```bash
   npx prisma migrate dev --name add_super_admin_role
   ```

### Add More Protected Routes

Edit `middleware.ts` and add to the `matcher` array:

```typescript
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/your-new-route/:path*",  // Add here
  ],
};
```

## Troubleshooting

### "Error: Invalid `prisma.user.findUnique()`"

Run `npx prisma generate` to regenerate the Prisma Client.

### Session Not Persisting

Check that `NEXTAUTH_SECRET` is set in `.env` and is the same across restarts.

### TypeScript Errors with Session

Ensure `types/next-auth.d.ts` is in your project and TypeScript includes it.

### Middleware Not Working

Ensure `middleware.ts` is in the root directory (not in `app/` or `lib/`).

## License

MIT

## Contributing

Feel free to submit issues or pull requests!



