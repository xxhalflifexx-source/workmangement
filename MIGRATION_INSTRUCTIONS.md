# Database Migration Instructions: Add User Permissions

## Overview
This migration adds a `permissions` JSON field to the User table to support the RBAC (Role-Based Access Control) system.

## Method 1: Using Prisma (Recommended)

### Step 1: Generate Prisma Client
```bash
npx prisma generate
```

### Step 2: Create and Apply Migration
```bash
npx prisma migrate dev --name add_user_permissions
```

This command will:
- Create a new migration file in `prisma/migrations/`
- Apply the migration to your database
- Update your Prisma Client

### Step 3: Verify Migration
```bash
npx prisma studio
```
Open Prisma Studio and check that the `User` table now has a `permissions` column.

---

## Method 2: Direct SQL (For Supabase or Manual Execution)

If you're using Supabase or prefer to run SQL directly:

### Step 1: Open Your Database SQL Editor
- **Supabase**: Go to SQL Editor in your Supabase dashboard
- **PostgreSQL**: Connect using psql or your preferred client

### Step 2: Run the Migration SQL

Copy and paste the following SQL:

```sql
-- Migration: Add permissions field to User table
-- This migration adds a JSON permissions field to store module access permissions

-- Add permissions column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" TEXT DEFAULT '{}';

-- Update existing users to have default permissions
-- Default permissions: timeClock=true, jobManagement=true, employeeHandbook=true, others=false
UPDATE "User" 
SET "permissions" = '{"timeClock":true,"jobManagement":true,"qualityControl":false,"hr":false,"finance":false,"inventory":false,"adminPanel":false,"employeeHandbook":true}'
WHERE "permissions" IS NULL OR "permissions" = '{}';

-- For ADMIN users, grant all permissions
UPDATE "User"
SET "permissions" = '{"timeClock":true,"jobManagement":true,"qualityControl":true,"hr":true,"finance":true,"inventory":true,"adminPanel":true,"employeeHandbook":true}'
WHERE "role" = 'ADMIN';

-- For MANAGER users, grant manager-level permissions
UPDATE "User"
SET "permissions" = '{"timeClock":true,"jobManagement":true,"qualityControl":true,"hr":true,"finance":true,"inventory":true,"adminPanel":false,"employeeHandbook":true}'
WHERE "role" = 'MANAGER';
```

### Step 3: Verify the Migration

Run this query to check:
```sql
SELECT id, name, email, role, permissions FROM "User" LIMIT 5;
```

You should see the `permissions` column populated with JSON strings.

---

## Method 3: Using Prisma Migrate Deploy (Production)

For production environments:

```bash
npx prisma migrate deploy
```

This applies pending migrations without creating new ones.

---

## Troubleshooting

### Error: Column already exists
If you see "column already exists", the migration may have already been applied. You can skip this step.

### Error: Table "User" does not exist
Make sure you're connected to the correct database and that Prisma has generated the schema correctly.

### Error: Permission denied
Ensure your database user has ALTER TABLE permissions.

### Reset and Retry (Development Only)
⚠️ **WARNING**: This will delete all data!

```bash
npx prisma migrate reset
```

Then run the migration again:
```bash
npx prisma migrate dev --name add_user_permissions
```

---

## Verification Checklist

After running the migration, verify:

- [ ] `User` table has `permissions` column
- [ ] Existing users have permissions set
- [ ] ADMIN users have all permissions enabled
- [ ] MANAGER users have manager-level permissions
- [ ] EMPLOYEE users have default permissions
- [ ] Application can read/write permissions

---

## Testing the Migration

1. **Check Database Schema**:
   ```bash
   npx prisma db pull
   ```
   This will update your schema.prisma if there are any differences.

2. **Test in Application**:
   - Log in as Admin
   - Navigate to Admin Panel → User Access Control
   - You should see all users with their permissions
   - Try toggling a permission and saving

3. **Check Permissions in Code**:
   ```typescript
   // In a server component or API route
   const user = await prisma.user.findFirst();
   console.log(user?.permissions); // Should show JSON string
   ```

---

## Rollback (If Needed)

If you need to rollback the migration:

### Using Prisma:
```bash
# Check migration history
npx prisma migrate status

# Rollback to previous migration
# Note: Prisma doesn't have a built-in rollback, you'll need to manually revert
```

### Using SQL:
```sql
-- Remove permissions column
ALTER TABLE "User" DROP COLUMN IF EXISTS "permissions";
```

---

## Next Steps After Migration

1. ✅ Migration complete
2. ✅ Test the Admin Panel → User Access Control page
3. ✅ Verify permissions are working on dashboard
4. ✅ Test access control on module pages

---

## Need Help?

If you encounter issues:
1. Check Prisma logs: `npx prisma migrate dev --name add_user_permissions --verbose`
2. Verify database connection in `.env` file
3. Ensure DATABASE_URL is correct
4. Check database user permissions

