# How to Verify the Migration

## Method 1: Using Supabase SQL Editor (Recommended)

### Step-by-Step:

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query" button (top right)

3. **Run Verification Query**
   - Paste this SQL:
   ```sql
   SELECT id, name, email, role, permissions FROM "User" LIMIT 5;
   ```
   - Click "Run" button (or press Ctrl+Enter / Cmd+Enter)

4. **Check Results**
   - You should see a table with 5 columns
   - The `permissions` column should contain JSON strings
   - Example values:
     - Employee: `{"timeClock":true,"jobManagement":true,"qualityControl":false,"hr":false,"finance":false,"inventory":false,"adminPanel":false,"employeeHandbook":true}`
     - Manager: `{"timeClock":true,"jobManagement":true,"qualityControl":true,"hr":true,"finance":true,"inventory":true,"adminPanel":false,"employeeHandbook":true}`
     - Admin: `{"timeClock":true,"jobManagement":true,"qualityControl":true,"hr":true,"finance":true,"inventory":true,"adminPanel":true,"employeeHandbook":true}`

### Expected Output Example:

| id | name | email | role | permissions |
|---|---|---|---|---|
| clx123... | John Doe | john@example.com | ADMIN | {"timeClock":true,"jobManagement":true,...} |
| clx456... | Jane Smith | jane@example.com | MANAGER | {"timeClock":true,"jobManagement":true,...} |
| clx789... | Bob Johnson | bob@example.com | EMPLOYEE | {"timeClock":true,"jobManagement":true,...} |

---

## Method 2: Using Prisma Studio (Local)

If your database is accessible locally:

1. **Open Terminal** in your project directory
2. **Run Prisma Studio**:
   ```bash
   npx prisma studio
   ```
3. **Navigate to User Table**
   - Prisma Studio will open in your browser (usually http://localhost:5555)
   - Click on "User" table
   - Check that the `permissions` column exists and has values

---

## Method 3: Additional Verification Queries

Run these queries to verify different aspects:

### Check if column exists:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'User' AND column_name = 'permissions';
```

### Count users with permissions set:
```sql
SELECT 
  role,
  COUNT(*) as total_users,
  COUNT(permissions) as users_with_permissions
FROM "User"
GROUP BY role;
```

### Check specific user permissions:
```sql
SELECT 
  name,
  email,
  role,
  permissions
FROM "User"
WHERE email = 'your-email@example.com';
```

### Verify Admin users have all permissions:
```sql
SELECT 
  name,
  email,
  permissions
FROM "User"
WHERE role = 'ADMIN'
LIMIT 3;
```

---

## Troubleshooting

### If you see `NULL` in permissions column:
- The migration UPDATE statements may not have run
- Re-run the UPDATE statements from the migration SQL

### If you get "column does not exist" error:
- The ALTER TABLE statement didn't run
- Re-run the ALTER TABLE statement:
  ```sql
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" TEXT DEFAULT '{}';
  ```

### If permissions column is empty `{}`:
- Run the UPDATE statements again to populate permissions based on roles

---

## Success Indicators

✅ Migration is successful if:
- `permissions` column exists in the User table
- All users have non-null permissions values
- Admin users have all permissions set to `true`
- Manager users have most permissions except `adminPanel`
- Employee users have only basic permissions (timeClock, jobManagement, employeeHandbook)

