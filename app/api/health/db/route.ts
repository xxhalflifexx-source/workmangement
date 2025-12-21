import { NextResponse } from "next/server";
import { checkRequiredTables, getMigrationPath, REQUIRED_TABLES } from "@/lib/db-health-check";

/**
 * Database health check endpoint
 * GET /api/health/db
 * 
 * Returns the health status of the database, including missing tables
 */
export async function GET() {
  try {
    const health = await checkRequiredTables();
    
    // Get migration files for missing tables
    const missingTableMigrations = health.missing.map((table) => ({
      table,
      migrationFile: getMigrationPath(table),
    }));

    // Group by migration file
    const migrationsByFile = new Map<string, string[]>();
    missingTableMigrations.forEach(({ table, migrationFile }) => {
      if (migrationFile) {
        if (!migrationsByFile.has(migrationFile)) {
          migrationsByFile.set(migrationFile, []);
        }
        migrationsByFile.get(migrationFile)!.push(table);
      }
    });

    const response = {
      healthy: health.allExist,
      timestamp: new Date().toISOString(),
      tables: {
        total: REQUIRED_TABLES.length,
        existing: health.existing.length,
        missing: health.missing.length,
      },
      missingTables: health.missing,
      existingTables: health.existing,
      migrations: Array.from(migrationsByFile.entries()).map(([file, tables]) => ({
        file,
        tables,
        instructions: `Run this SQL file in Supabase SQL Editor: ${file}`,
      })),
      instructions: health.missing.length > 0
        ? [
            "1. Open Supabase Dashboard → SQL Editor",
            "2. Run the migration files listed above",
            "3. Or run: npm run check-db",
          ]
        : ["All required tables exist. Database is healthy."],
    };

    return NextResponse.json(response, {
      status: health.allExist ? 200 : 503, // 503 Service Unavailable if tables missing
    });
  } catch (error: any) {
    console.error("Database health check error:", error);
    return NextResponse.json(
      {
        healthy: false,
        error: error?.message || "Failed to check database health",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

