# Fix: Add DIRECT_URL to Your .env File

## The Problem
Your `.env` file is missing the `DIRECT_URL` variable, which is needed for database migrations.

---

## Quick Fix - Step by Step

### Step 1: Find Your .env File
1. Open **File Explorer** (Windows key + E)
2. Navigate to: `C:\Users\King\Documents\GitHub\workmangement`
3. Look for a file named `.env` (it might be hidden, so you may need to show hidden files)

**OR** if you're using VS Code:
1. In VS Code, look at the left sidebar (file explorer)
2. Find `.env` file in the root folder
3. Click on it to open

---

### Step 2: Open the .env File
- **Double-click** `.env` to open it in Notepad
- **OR** right-click → Open with → Notepad
- **OR** if in VS Code, just click it

---

### Step 3: Add DIRECT_URL

Look for a line that says:
```
DATABASE_URL=postgresql://...
```

**Right after that line**, add a new line:
```
DIRECT_URL=postgresql://...
```

**Important:** The `DIRECT_URL` should be the **direct connection** string (not the pooler).

---

### Step 4: What to Put for DIRECT_URL

If you already have `DATABASE_URL`, the `DIRECT_URL` is usually the same connection string but:
- **Remove** `?pgbouncer=true` from the end
- **Change** the port from `6543` to `5432`
- **Change** `db.pooler.supabase.com` to `db.supabase.com`

**Example:**

If your `DATABASE_URL` is:
```
DATABASE_URL=postgresql://postgres:password@db.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Then your `DIRECT_URL` should be:
```
DIRECT_URL=postgresql://postgres:password@db.supabase.com:5432/postgres
```

---

### Step 5: Save the File
1. Press **Ctrl + S** to save
2. **OR** File → Save
3. Close the file

---

### Step 6: Run the Migration Again

Go back to your terminal (Command Prompt) and run:
```
npx prisma migrate dev --name add_user_access_overrides
```

---

## If You Don't Have DIRECT_URL

### Option 1: Get It From Supabase Dashboard
1. Go to **https://supabase.com/dashboard**
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll to **Connection string** section
5. Copy the **"Direct connection"** string
6. Paste it as `DIRECT_URL` in your `.env` file

### Option 2: Use the Same as DATABASE_URL (Temporary)
If you can't access Supabase right now, you can temporarily use:
```
DIRECT_URL=postgresql://[same-as-DATABASE_URL-but-remove-pgbouncer]
```

Just make sure to:
- Remove `?pgbouncer=true`
- Change port `6543` → `5432`
- Change `db.pooler.supabase.com` → `db.supabase.com`

---

## Example .env File

Your `.env` file should look something like this:

```env
DATABASE_URL=postgresql://postgres:yourpassword@db.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:yourpassword@db.supabase.com:5432/postgres
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key-here
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

---

## After Adding DIRECT_URL

1. Save the `.env` file
2. Go back to terminal
3. Run the migration command again:
   ```
   npx prisma migrate dev --name add_user_access_overrides
   ```

It should work now! ✅

