#!/usr/bin/env npx tsx
/**
 * Self-test script for soft cap feature
 * 
 * This script:
 * 1. Verifies Prisma client is generated
 * 2. Runs unit tests for soft cap logic
 * 3. Runs a smoke test scenario simulating:
 *    clockIn -> work 8h -> startBreak 1h -> endBreak -> work 8h -> verify flagged
 * 
 * Usage:
 *   npx tsx scripts/self_test_soft_cap.ts
 *   npm run test:soft-cap
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
  reset: "\x1b[0m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, message: string) {
  log(`\n[$step ${step}] ${message}`, "blue");
}

function logSuccess(message: string) {
  log(`✓ ${message}`, "green");
}

function logError(message: string) {
  log(`✗ ${message}`, "red");
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

async function runSmokeTest(): Promise<boolean> {
  log("\n  Running smoke test for soft cap logic...", "yellow");
  
  try {
    // Import the cap functions
    const capModule = await import("../lib/time-entry-cap");
    const {
      TimeEntryState,
      FlagStatus,
      createInitialCapFields,
      prepareStartBreak,
      prepareEndBreak,
      getNetWorkSeconds,
      applySoftCapFlag,
    } = capModule;
    // Simulate: clockIn -> work 8h -> startBreak 1h -> endBreak -> work 8h -> verify flagged
    const clockIn = new Date("2026-01-03T06:00:00Z");
    const capFields = createInitialCapFields(clockIn);
    
    // Create mock entry matching MutableTimeEntry interface
    const entry = {
      id: "smoke-test-entry",
      clockIn,
      clockOut: null,
      state: capFields.state,
      workAccumSeconds: capFields.workAccumSeconds,
      lastStateChangeAt: capFields.lastStateChangeAt,
      capMinutes: capFields.capMinutes,
      flagStatus: capFields.flagStatus,
      overCapAt: capFields.overCapAt,
    };

    // Step 1: Work 8 hours
    let now = new Date("2026-01-03T14:00:00Z"); // 6am + 8h = 2pm
    prepareStartBreak(entry, now);
    
    if (entry.workAccumSeconds !== 8 * 3600) {
      throw new Error(`Expected 8h work, got ${entry.workAccumSeconds / 3600}h`);
    }
    logSuccess("Work 8 hours accumulated correctly");

    // Step 2: Break 1 hour
    now = new Date("2026-01-03T15:00:00Z"); // 2pm + 1h = 3pm
    prepareEndBreak(entry, now);
    
    if (entry.workAccumSeconds !== 8 * 3600) {
      throw new Error(`Break added time incorrectly: ${entry.workAccumSeconds / 3600}h`);
    }
    logSuccess("Break did not add to work time");

    // Step 3: Work another 8 hours (total 16h, should trigger flag)
    now = new Date("2026-01-03T23:00:00Z"); // 3pm + 8h = 11pm
    const netWork = getNetWorkSeconds(entry, now);
    
    if (netWork !== 16 * 3600) {
      throw new Error(`Expected 16h net work, got ${netWork / 3600}h`);
    }
    logSuccess("Net work time calculated correctly (16h)");

    // Step 4: Apply soft cap flag
    applySoftCapFlag(entry, now);
    
    if (entry.flagStatus !== FlagStatus.OVER_CAP) {
      throw new Error(`Expected OVER_CAP flag, got ${entry.flagStatus}`);
    }
    logSuccess("Entry correctly flagged as OVER_CAP");

    // Step 5: Verify overCapAt is set
    if (!entry.overCapAt) {
      throw new Error("overCapAt should be set");
    }
    logSuccess("overCapAt timestamp recorded");

    logSuccess("Smoke test passed!");
    return true;
  } catch (error) {
    logError(`Smoke test failed: ${error}`);
    return false;
  }
}

async function main() {
  log("\n========================================", "blue");
  log("  Soft Cap Feature Self-Test", "blue");
  log("========================================", "blue");

  let allPassed = true;

  // Step 1: Generate Prisma client
  logStep(1, "Generating Prisma client");
  if (!runCommand("npx prisma generate", "Prisma client generation")) {
    allPassed = false;
  }

  // Step 2: Run unit tests for soft cap
  logStep(2, "Running soft cap unit tests");
  if (!runCommand(
    "npx jest __tests__/unit/lib/time-entry-cap.test.ts --passWithNoTests",
    "Soft cap unit tests"
  )) {
    allPassed = false;
  }

  // Step 3: Run smoke test
  logStep(3, "Running smoke test scenario");
  if (!(await runSmokeTest())) {
    allPassed = false;
  }

  // Summary
  log("\n========================================", "blue");
  if (allPassed) {
    logSuccess("All soft cap tests passed!");
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

