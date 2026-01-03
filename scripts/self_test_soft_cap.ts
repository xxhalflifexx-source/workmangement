#!/usr/bin/env npx tsx
/**
 * Self-test script for soft cap feature
 * 
 * This script:
 * 1. Verifies Prisma client is generated
 * 2. Runs unit tests for soft cap logic
 * 
 * The unit tests include a comprehensive smoke test scenario covering:
 * clockIn -> work 8h -> startBreak 1h -> endBreak -> work 8h -> verify flagged
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
  log(`\n[Step ${step}] ${message}`, "blue");
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

  // Step 2: Run unit tests for soft cap (includes smoke test scenarios)
  logStep(2, "Running soft cap unit tests");
  if (!runCommand(
    "npx jest __tests__/unit/lib/time-entry-cap.test.ts --passWithNoTests --verbose",
    "Soft cap unit tests"
  )) {
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

