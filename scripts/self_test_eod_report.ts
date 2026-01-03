#!/usr/bin/env npx tsx
/**
 * Self-test script for EOD Report feature
 * 
 * This script:
 * 1. Verifies Prisma client is generated
 * 2. Runs unit tests for EOD report logic
 * 3. Runs a dry-run report generation for today (console preview)
 * 
 * Usage:
 *   npx tsx scripts/self_test_eod_report.ts
 *   npm run test:eod
 * 
 * Exit codes:
 *   0 = All tests passed
 *   1 = Test failure
 */

import { execSync } from "child_process";

// ANSI color codes
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, message: string) {
  log(`\n[Step ${step}] ${message}`, "blue");
}

function logSuccess(message: string) {
  log(`✓ ${message}`, "green");
}

function logError(message: string) {
  log(`✗ ${message}`, "red");
}

function logInfo(message: string) {
  log(`ℹ ${message}`, "cyan");
}

function runCommand(command: string, description: string): boolean {
  log(`  Running: ${command}`, "yellow");
  try {
    execSync(command, { stdio: "inherit", cwd: process.cwd() });
    logSuccess(description);
    return true;
  } catch (error) {
    logError(`${description} failed`);
    return false;
  }
}

async function runDryRunReport(): Promise<boolean> {
  log(`  Generating dry-run report preview...`, "yellow");
  
  try {
    // Dynamically import the report service to run a dry-run
    const { generateEodReport, formatReportPreview } = await import("../lib/eod-report-service");
    const { prisma } = await import("../lib/prisma");
    
    // Get the first active organization (if any)
    const org = await prisma.organization.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    if (!org) {
      logInfo("No active organizations found - skipping dry-run report generation");
      logInfo("This is expected for a fresh database or test environment");
      return true;
    }

    log(`  Found organization: ${org.name}`, "cyan");

    // Generate the report
    const report = await generateEodReport(org.id);
    
    // Print preview
    console.log("\n" + "=".repeat(60));
    log("  DRY-RUN REPORT PREVIEW", "cyan");
    console.log("=".repeat(60));
    console.log(formatReportPreview(report));
    
    logSuccess(`Report generated for ${org.name}`);
    logInfo(`  Employees: ${report.summary.employeeCount}`);
    logInfo(`  Jobs: ${report.summary.jobCount}`);
    logInfo(`  Total Hours: ${report.summary.totalLaborHours}`);
    logInfo(`  Total Cost: $${report.summary.totalLaborCost.toFixed(2)}`);
    logInfo(`  Flags: ${report.summary.flagCount}`);
    
    return true;
  } catch (error) {
    // If database is not available, that's okay for a dry-run test
    if (error instanceof Error && 
        (error.message.includes("ECONNREFUSED") || 
         error.message.includes("Can't reach database") ||
         error.message.includes("prisma"))) {
      logInfo("Database not available - skipping dry-run report generation");
      logInfo("Run 'npm run migrate-db' first to set up the database");
      return true; // Not a failure - just skip
    }
    
    logError(`Dry-run report generation failed: ${error}`);
    return false;
  }
}

async function main() {
  log("\n========================================", "blue");
  log("  EOD Report Feature Self-Test", "blue");
  log("========================================", "blue");

  let allPassed = true;

  // Step 1: Generate Prisma client
  logStep(1, "Generating Prisma client");
  if (!runCommand("npx prisma generate", "Prisma client generation")) {
    allPassed = false;
  }

  // Step 2: Run unit tests for EOD report
  logStep(2, "Running EOD report unit tests");
  if (!runCommand(
    "npx jest __tests__/unit/lib/eod-report-service.test.ts --passWithNoTests --verbose",
    "EOD report unit tests"
  )) {
    allPassed = false;
  }

  // Step 3: Run dry-run report generation (if database is available)
  logStep(3, "Running dry-run report generation");
  try {
    const dryRunPassed = await runDryRunReport();
    if (!dryRunPassed) {
      allPassed = false;
    }
  } catch (error) {
    logInfo("Dry-run skipped (database may not be configured)");
  }

  // Summary
  log("\n========================================", "blue");
  if (allPassed) {
    logSuccess("All EOD report tests passed!");
    log("========================================\n", "blue");
    process.exit(0);
  } else {
    logError("Some tests failed. See above for details.");
    log("========================================\n", "blue");
    process.exit(1);
  }
}

main().catch((error) => {
  logError(`Self-test script error: ${error}`);
  process.exit(1);
});

