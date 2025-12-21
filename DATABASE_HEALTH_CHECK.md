# Database Health Check System

This system automatically detects missing database tables and provides clear error messages with fix instructions.

## Quick Start

### Check Database Health
```bash
npm run check-db
```

### View Migration Instructions
```bash
npm run migrate-db
```

### Get JSON Health Status
```bash
npm run db-health
```

### Check via API
Visit: `http://localhost:3000/api/health/db` (or your production URL)

---

## How It Works

### 1. Automatic Error Detection
When a database operation fails due to missing tables, you'll now see:
```
Database Error: Table 'SOPDocument' does not exist.

To fix this:
1. Open Supabase Dashboard → SQL Editor
2. Run the migration file: prisma/migrations/add_sop_tables.sql
3. Or run: npm run check-db

Migration file location: prisma/migrations/add_sop_tables.sql
```

### 2. Health Check API
The `/api/health/db` endpoint returns:
- List of missing tables
- List of existing tables
- Migration files needed
- Step-by-step instructions

### 3. Command Line Tools
- `npm run check-db` - Shows what's missing
- `npm run migrate-db` - Shows migration SQL to run
- `npm run db-health` - JSON output for scripts

---

## What Gets Checked

The system checks for these critical tables:
- User, Account, Session (authentication)
- Job, Customer, TimeEntry (core features)
- SOPDocument, SOPTemplate (SOP features)
- OperationsCommonFolder, OperationsCommonFile (file management)

---

## Adding New Tables

When you add a new table to the schema:

1. Add it to `REQUIRED_TABLES` in `lib/db-health-check.ts`
2. Add migration mapping to `TABLE_MIGRATIONS` in `lib/db-health-check.ts`
3. The system will automatically detect if it's missing

---

## Error Messages

All database errors in SOP actions now:
- Detect "table missing" errors automatically
- Provide migration file paths
- Give step-by-step fix instructions
- Work even if error message format changes

---

## Safety Features

- ✅ Read-only checks (never modifies database)
- ✅ Clear error messages
- ✅ Migration file locations provided
- ✅ Works in development and production

