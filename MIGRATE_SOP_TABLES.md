# Database Migration: Add SOP Tables

This migration adds the `SOPDocument` and `SOPTemplate` tables to your database.

## Quick Migration (Supabase SQL Editor - Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Open the file: `prisma/migrations/add_sop_tables.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

4. **Verify Success**
   - You should see: "Success. No rows returned"
   - Check the Table Editor to confirm `SOPDocument` and `SOPTemplate` tables exist

## Alternative: Prisma Migrate (For Local Development)

If you have local database access:

```bash
# Generate Prisma Client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_sop_documents_and_templates
```

## What This Migration Creates

- **SOPDocument table**: Stores SOP documents with title, content, folder relationships
- **SOPTemplate table**: Stores reusable document templates
- **Foreign keys**: Links to User and OperationsCommonFolder tables
- **Indexes**: Optimizes folder-based queries

## Troubleshooting

**Error: "relation already exists"**
- Tables may already exist. Check in Supabase Table Editor.
- If they exist, the migration is already complete.

**Error: "foreign key constraint fails"**
- Ensure `User` and `OperationsCommonFolder` tables exist first.
- Run the initial migration if needed.

**Error: "permission denied"**
- Check that your database user has CREATE TABLE permissions.
- Contact your database administrator if needed.

