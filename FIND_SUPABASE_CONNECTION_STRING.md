# How to Find Connection Strings in Supabase - Detailed Steps

## Step-by-Step Guide

### Step 1: Go to Supabase Dashboard
1. Open your web browser
2. Go to: **https://supabase.com/dashboard**
3. Log in with your account

### Step 2: Select Your Project
1. You'll see a list of projects (or just one project)
2. **Click on your project** to open it

### Step 3: Go to Settings
1. Look at the **left sidebar** (menu on the left side)
2. Find the **gear icon** ⚙️ at the bottom
3. Click on it - it says **"Settings"**
4. OR look for **"Settings"** in the menu

### Step 4: Click on "Database"
1. After clicking Settings, you'll see a menu on the left
2. Look for **"Database"** in that menu
3. Click on **"Database"**

### Step 5: Find "Connection string" Section
1. Scroll down the page
2. Look for a section called **"Connection string"** or **"Connection strings"**
3. You might see tabs like:
   - **"URI"**
   - **"Transaction Pooler"**
   - **"Direct connection"**
   - **"Session mode"**

### Step 6: Copy the Direct Connection String
1. Click on the **"Direct connection"** tab (or look for it)
2. You'll see a connection string that looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.supabase.com:5432/postgres
   ```
3. **Copy this entire string**
4. Replace `[YOUR-PASSWORD]` with your actual database password

---

## Alternative: If You Can't Find "Connection string" Section

### Look for These Sections Instead:

1. **"Connection info"** - Click here
2. **"Connection pooling"** - Check here
3. **"Database settings"** - Look here
4. **"Connection parameters"** - Check this section

---

## What the Connection String Should Look Like

### For DIRECT_URL (what you need):
```
postgresql://postgres:YOUR_PASSWORD@db.supabase.com:5432/postgres
```

### For DATABASE_URL (pooler):
```
postgresql://postgres:YOUR_PASSWORD@db.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Important differences:**
- DIRECT_URL uses: `db.supabase.com:5432` (port 5432)
- DATABASE_URL uses: `db.pooler.supabase.com:6543` (port 6543) with `?pgbouncer=true`

---

## If You Still Can't Find It

### Option A: Look in "Project Settings"
1. Click on **Settings** (gear icon)
2. Look for **"Project Settings"** or **"General"**
3. Scroll down to find database connection info

### Option B: Check "API" Section
1. Go to Settings → **API**
2. Sometimes connection info is shown here
3. Look for database connection details

### Option C: Use "Connection Pooling" Section
1. Go to Settings → **Database**
2. Look for **"Connection Pooling"** section
3. Connection strings might be here

---

## Quick Visual Guide

**Supabase Dashboard Structure:**
```
Dashboard
├── Your Project
    ├── Table Editor
    ├── SQL Editor
    ├── Authentication
    ├── Storage
    └── Settings ⚙️ (bottom left)
        ├── General
        ├── API
        ├── Database ← CLICK HERE
        │   └── Connection string ← FIND THIS SECTION
        ├── Auth
        └── Storage
```

---

## Still Having Trouble?

**Tell me:**
1. What do you see when you click Settings → Database?
2. What sections/tabs are visible on that page?
3. Can you see any text that says "connection" or "database"?

I can help you find it based on what you're seeing!

