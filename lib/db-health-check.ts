import { prisma } from "./prisma";

// Registry of tables and their migration files
export const TABLE_MIGRATIONS: Record<string, string> = {
  SOPDocument: "prisma/migrations/add_sop_tables.sql",
  SOPTemplate: "prisma/migrations/add_sop_tables.sql",
  OperationsCommonFolder: "prisma/migrations/create_operations_common_tables.sql",
  OperationsCommonFile: "prisma/migrations/create_operations_common_tables.sql",
  ManualFolder: "prisma/migrations/manual_tables_migration.sql",
  ManualFile: "prisma/migrations/manual_tables_migration.sql",
  Notification: "prisma/migrations/add_notifications_table.sql",
  UserAccessOverride: "prisma/migrations/add_user_access_overrides/migration.sql",
};

// List of critical tables that should exist
export const REQUIRED_TABLES = [
  "User",
  "Account",
  "Session",
  "Job",
  "Customer",
  "TimeEntry",
  "SOPDocument",
  "SOPTemplate",
  "OperationsCommonFolder",
  "OperationsCommonFile",
];

/**
 * Check if a specific table exists in the database
 */
export async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    // Use Prisma's raw query to check if table exists
    // PostgreSQL syntax - use Prisma.sql for parameterized queries
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ) as exists;
    `;
    return result[0]?.exists ?? false;
  } catch (error: any) {
    // If query fails, try alternative method
    try {
      // Alternative: Try to query the table directly (will fail if doesn't exist)
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "${tableName}" LIMIT 1`);
      return true;
    } catch {
      // Table doesn't exist
      return false;
    }
  }
}

/**
 * Check multiple tables and return which are missing
 */
export async function checkRequiredTables(): Promise<{
  missing: string[];
  existing: string[];
  allExist: boolean;
}> {
  const results = await Promise.all(
    REQUIRED_TABLES.map(async (table) => ({
      name: table,
      exists: await checkTableExists(table),
    }))
  );

  const missing = results.filter((r) => !r.exists).map((r) => r.name);
  const existing = results.filter((r) => r.exists).map((r) => r.name);

  return {
    missing,
    existing,
    allExist: missing.length === 0,
  };
}

/**
 * Get migration file path for a table
 */
export function getMigrationPath(tableName: string): string | null {
  return TABLE_MIGRATIONS[tableName] || null;
}

/**
 * Get user-friendly error message for missing table
 */
export function getMissingTableError(tableName: string): string {
  const migrationPath = getMigrationPath(tableName);
  
  let message = `Database Error: Table '${tableName}' does not exist.\n\n`;
  message += `To fix this:\n`;
  
  if (migrationPath) {
    message += `1. Open Supabase Dashboard → SQL Editor\n`;
    message += `2. Run the migration file: ${migrationPath}\n`;
    message += `3. Or run: npm run check-db\n\n`;
    message += `Migration file location: ${migrationPath}`;
  } else {
    message += `1. Run database migration: npx prisma migrate deploy\n`;
    message += `2. Or check Prisma schema and create migration manually`;
  }
  
  return message;
}

/**
 * Detect if an error is a "table does not exist" error
 */
export function isTableMissingError(error: any): boolean {
  if (!error || !error.message) return false;
  
  const message = error.message.toLowerCase();
  const patterns = [
    "does not exist in the current database",
    "relation",
    "does not exist",
    "unknown table",
    "table",
    "doesn't exist",
  ];
  
  // Check if error contains table-related keywords
  const hasTableKeyword = patterns.some((pattern) => message.includes(pattern));
  
  // Check for Prisma-specific error codes
  const prismaErrorCodes = ["P2001", "P2025"]; // Common Prisma error codes for missing tables
  
  return (
    hasTableKeyword ||
    prismaErrorCodes.some((code) => message.includes(code)) ||
    error.code === "P2001" ||
    error.code === "P2025"
  );
}

/**
 * Extract table name from error message if possible
 */
export function extractTableNameFromError(error: any): string | null {
  if (!error || !error.message) return null;
  
  const message = error.message;
  
  // Try to find table name in common error formats
  // Pattern: "Table `public.SOPDocument` does not exist"
  const tableMatch = message.match(/Table[`'"]?\s*(?:public\.)?([A-Za-z][A-Za-z0-9_]*)/i);
  if (tableMatch) return tableMatch[1];
  
  // Pattern: "relation \"SOPDocument\" does not exist"
  const relationMatch = message.match(/relation[`'"]?\s*"([A-Za-z][A-Za-z0-9_]*)"/i);
  if (relationMatch) return relationMatch[1];
  
  // Pattern: "SOPDocument" in error message
  for (const tableName of REQUIRED_TABLES) {
    if (message.includes(tableName)) {
      return tableName;
    }
  }
  
  return null;
}

