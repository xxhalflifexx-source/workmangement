import { prisma } from "../lib/prisma";
import {
  checkRequiredTables,
  checkTableExists,
  getMigrationPath,
  TABLE_MIGRATIONS,
  REQUIRED_TABLES,
} from "../lib/db-health-check";
import * as fs from "fs";
import * as path from "path";

const args = process.argv.slice(2);
const mode = args[0] || "--check";

async function main() {
  console.log("🔍 Checking database health...\n");

  try {
    const health = await checkRequiredTables();

    console.log(`📊 Database Status:`);
    console.log(`   Total tables checked: ${REQUIRED_TABLES.length}`);
    console.log(`   ✅ Existing: ${health.existing.length}`);
    console.log(`   ❌ Missing: ${health.missing.length}\n`);

    if (health.allExist) {
      console.log("✅ All required tables exist! Database is healthy.\n");
      process.exit(0);
    }

    // Show missing tables
    console.log("❌ Missing Tables:");
    health.missing.forEach((table) => {
      const migrationFile = getMigrationPath(table);
      console.log(`   - ${table}${migrationFile ? ` (migration: ${migrationFile})` : ""}`);
    });
    console.log("");

    // Group missing tables by migration file
    const migrationsByFile = new Map<string, string[]>();
    health.missing.forEach((table) => {
      const migrationFile = getMigrationPath(table);
      if (migrationFile) {
        if (!migrationsByFile.has(migrationFile)) {
          migrationsByFile.set(migrationFile, []);
        }
        migrationsByFile.get(migrationFile)!.push(table);
      }
    });

    if (migrationsByFile.size === 0) {
      console.log("⚠️  No migration files found for missing tables.");
      console.log("   Run: npx prisma migrate deploy\n");
      process.exit(1);
    }

    // Show migration files
    console.log("📄 Migration Files Needed:");
    migrationsByFile.forEach((tables, file) => {
      console.log(`   ${file}`);
      console.log(`     Tables: ${tables.join(", ")}`);
    });
    console.log("");

    if (mode === "--check") {
      console.log("💡 To apply migrations:");
      console.log("   1. Copy the SQL from the migration files above");
      console.log("   2. Run them in Supabase SQL Editor");
      console.log("   3. Or run: npm run migrate-db\n");
      process.exit(1);
    }

    if (mode === "--migrate") {
      console.log("⚠️  Auto-migration is not implemented for safety.");
      console.log("   Please run migrations manually in Supabase SQL Editor.\n");
      console.log("📋 Migration Instructions:");
      migrationsByFile.forEach((tables, file) => {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          console.log(`\n   File: ${file}`);
          console.log(`   Tables: ${tables.join(", ")}`);
          console.log(`   Location: ${filePath}`);
          console.log(`   \n   SQL Content:`);
          console.log(`   ${"=".repeat(60)}`);
          try {
            const sql = fs.readFileSync(filePath, "utf-8");
            console.log(sql);
          } catch (err) {
            console.log(`   Error reading file: ${err}`);
          }
          console.log(`   ${"=".repeat(60)}\n`);
        } else {
          console.log(`\n   ⚠️  File not found: ${filePath}`);
        }
      });
      process.exit(1);
    }

    if (mode === "--health") {
      // JSON output for programmatic use
      const output = {
        healthy: health.allExist,
        missing: health.missing,
        existing: health.existing,
        migrations: Array.from(migrationsByFile.entries()).map(([file, tables]) => ({
          file,
          tables,
          exists: fs.existsSync(path.join(process.cwd(), file)),
        })),
      };
      console.log(JSON.stringify(output, null, 2));
      process.exit(health.allExist ? 0 : 1);
    }
  } catch (error: any) {
    console.error("❌ Error checking database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

