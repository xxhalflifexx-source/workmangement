# 🚀 Simple Migration Guide - Step by Step

Since you're switching from PostgreSQL to SQLite, here's the easiest way to add the new invoice fields.

## ✅ Step 1: Open Terminal

**In Cursor:**
- Press `Ctrl + ~` (Control + Tilde)
- OR click "Terminal" tab at bottom

## ✅ Step 2: Run This Command

Copy and paste this command, then press Enter:

```bash
npx prisma db push
```

**What this does:**
- Pushes your schema changes directly to the database
- No migration files needed
- Works perfectly for SQLite

**You should see:**
```
✔ Your database is now in sync with your Prisma schema.
```

## ✅ Step 3: Regenerate Prisma Client

Run this command:

```bash
npx prisma generate
```

**You should see:**
```
✔ Generated Prisma Client
```

## ✅ Step 4: Test It!

1. Start your server:
   ```bash
   npm run dev
   ```

2. Go to: http://localhost:3000/invoices

3. Create a new invoice - it should get number `INV-250001`!

---

## 🎉 That's It!

The `prisma db push` command is simpler than migrations for SQLite. It directly syncs your schema with the database.

---

## 📝 Alternative: If `db push` Doesn't Work

If you get an error, you can manually run the SQL:

1. Install a SQLite browser: https://sqlitebrowser.org/
2. Open `prisma/dev.db` in the browser
3. Go to "Execute SQL" tab
4. Copy and paste the SQL from `prisma/migrations/manual_add_invoice_fields.sql`
5. Click "Execute"

Then run: `npx prisma generate`

