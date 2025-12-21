import { checkRequiredTables } from "./db-health-check";

/**
 * Initialize database health check
 * Call this on app startup (development only)
 * Logs warnings but doesn't block app startup
 */
export async function initDatabaseHealthCheck() {
  // Only run in development
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  try {
    const health = await checkRequiredTables();

    if (!health.allExist && health.missing.length > 0) {
      console.warn("\n⚠️  Database Health Warning:");
      console.warn(`   Missing tables: ${health.missing.join(", ")}`);
      console.warn(`   Run: npm run check-db`);
      console.warn(`   Or visit: /api/health/db\n`);
    } else {
      console.log("✅ Database health check passed - all tables exist");
    }
  } catch (error) {
    // Don't block startup if health check fails
    console.warn("⚠️  Could not check database health:", error);
  }
}

// Auto-run in development (optional - can be called manually instead)
if (process.env.NODE_ENV === "development" && typeof window === "undefined") {
  // Only run on server side
  initDatabaseHealthCheck().catch(() => {
    // Silently fail - don't block startup
  });
}

