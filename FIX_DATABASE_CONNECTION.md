# Fix Database Connection Error

## Current Error
```
Error: P1001: Can't reach database server at `db.supabase.com:5432`
```

## What This Means
The `.env` file is now created correctly, but Prisma can't connect to your Supabase database using the direct connection.

---

## Solutions

### Solution 1: Check Supabase Connection Settings

1. Go to **https://supabase.com/dashboard**
2. Select your project
3. Go to **Settings** → **Database**
4. Check **Connection string** section
5. Make sure you're using the correct **Direct connection** string
6. Verify your database password is correct

### Solution 2: Enable Direct Connections in Supabase

Some Supabase projects require IP allowlisting for direct connections:

1. Go to **Settings** → **Database**
2. Look for **Connection pooling** or **Network restrictions**
3. Make sure direct connections are allowed
4. If there's an IP allowlist, you may need to add your IP address

### Solution 3: Use Pooler for Migrations (Alternative)

If direct connection doesn't work, you can temporarily modify the schema:

**Note:** This is not recommended for production, but can work for local development.

---

## Quick Check: Verify Your Connection String

Your current `DIRECT_URL` should look like:
```
DIRECT_URL=postgresql://postgres:YOUR_PASSWORD@db.supabase.com:5432/postgres
```

Make sure:
- ✅ Password is correct
- ✅ No extra spaces
- ✅ Port is `5432` (not `6543`)
- ✅ Host is `db.supabase.com` (not `db.pooler.supabase.com`)

---

## Next Steps

1. **Verify your Supabase credentials** - Make sure the password in `DIRECT_URL` is correct
2. **Check Supabase dashboard** - Ensure direct connections are enabled
3. **Try the migration again** after verifying settings

---

## If Still Not Working

The issue might be:
- Network/firewall blocking the connection
- Supabase project settings restricting direct connections
- Incorrect password or connection string

**Ask your boss/admin to:**
- Verify the database connection string
- Check if direct connections are enabled
- Provide the correct `DIRECT_URL` from Supabase dashboard

