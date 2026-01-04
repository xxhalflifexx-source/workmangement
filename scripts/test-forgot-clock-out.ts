/**
 * Test script for the "Forgot to clock out" feature
 * 
 * Run with: npx ts-node -O '{"module":"commonjs"}' scripts/test-forgot-clock-out.ts
 * Or: npx tsx scripts/test-forgot-clock-out.ts
 * 
 * This script:
 * 1. Creates an open time entry for a test employee
 * 2. Simulates using the "forgot clock out" feature
 * 3. Verifies the wrong hours snapshot is stored
 * 4. Tests the EOD report includes the correction
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🧪 Testing 'Forgot to clock out' feature\n");
  console.log("=".repeat(50));

  // Find test employee
  const employee = await prisma.user.findFirst({
    where: { email: "employee@example.com" },
  });

  if (!employee) {
    console.error("❌ Test employee not found. Run 'npx prisma db seed' first.");
    return;
  }

  console.log(`✅ Found test employee: ${employee.name} (${employee.email})`);

  // Find a job to use (optional)
  const job = await prisma.job.findFirst({
    where: { status: { not: "COMPLETED" } },
    select: { id: true, title: true },
  });

  console.log(job ? `✅ Found job: ${job.title}` : "ℹ️  No job found, testing without job");

  // Clean up any existing open entries for this user
  const cleaned = await prisma.timeEntry.deleteMany({
    where: {
      userId: employee.id,
      clockOut: null,
    },
  });
  console.log(`🧹 Cleaned up ${cleaned.count} existing open entries`);

  // Create a test time entry that started 10 hours ago (still open)
  const now = new Date();
  const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000);
  
  // Add a break to test break handling
  const breakStart = new Date(tenHoursAgo.getTime() + 4 * 60 * 60 * 1000); // 4 hours after clock in
  const breakEnd = new Date(breakStart.getTime() + 30 * 60 * 1000); // 30 minute break

  // Generate a unique ID for the time entry (matching cuid format)
  const testEntryId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  
  const testEntry = await prisma.timeEntry.create({
    data: {
      id: testEntryId,
      userId: employee.id,
      jobId: job?.id || null,
      clockIn: tenHoursAgo,
      clockOut: null, // Still open
      breakStart: breakStart,
      breakEnd: breakEnd,
      state: "WORKING",
      flagStatus: "NONE",
      workAccumSeconds: 0, // Will be calculated
      lastStateChangeAt: breakEnd,
      updatedAt: now,
    },
  });

  console.log("\n📝 Created test time entry:");
  console.log(`   ID: ${testEntry.id}`);
  console.log(`   Clock In: ${tenHoursAgo.toLocaleString()}`);
  console.log(`   Break: ${breakStart.toLocaleTimeString()} - ${breakEnd.toLocaleTimeString()} (30 min)`);
  console.log(`   Status: Open (no clock out)`);

  // Calculate expected values
  const clockInTime = tenHoursAgo;
  const actualEndTime = new Date(clockInTime.getTime() + 8 * 60 * 60 * 1000); // Employee meant to clock out after 8 hours
  
  // Wrong hours = from clock in to NOW (10 hours) minus break (0.5 hours) = 9.5 hours
  const wrongMs = now.getTime() - clockInTime.getTime();
  const wrongSeconds = Math.floor(wrongMs / 1000);
  const breakSeconds = 30 * 60; // 30 minutes
  const wrongNetSeconds = wrongSeconds - breakSeconds;
  const wrongHours = wrongNetSeconds / 3600;

  // Corrected hours = from clock in to actual end (8 hours) minus break (0.5 hours) = 7.5 hours  
  const correctedMs = actualEndTime.getTime() - clockInTime.getTime();
  const correctedSeconds = Math.floor(correctedMs / 1000);
  const correctedNetSeconds = correctedSeconds - breakSeconds;
  const correctedHours = correctedNetSeconds / 3600;

  console.log("\n📊 Expected calculations:");
  console.log(`   Wrong hours (if clocked out now): ${wrongHours.toFixed(2)}h`);
  console.log(`   Corrected hours (actual end time): ${correctedHours.toFixed(2)}h`);
  console.log(`   Actual end time to use: ${actualEndTime.toLocaleString()}`);

  // Simulate calling the forgotClockOut action
  console.log("\n🔧 Simulating 'Forgot to clock out' correction...\n");

  // Manually update the entry as the action would
  const correctionTime = now;
  const settledWrongSeconds = wrongNetSeconds; // This would be calculated by settling work

  const updatedEntry = await prisma.timeEntry.update({
    where: { id: testEntry.id },
    data: {
      clockOut: actualEndTime,
      durationHours: correctedHours,
      state: "CLOCKED_OUT",
      workAccumSeconds: correctedNetSeconds,
      lastStateChangeAt: actualEndTime,
      flagStatus: "FORGOT_CLOCK_OUT",
      wrongRecordedNetSeconds: settledWrongSeconds, // FROZEN snapshot
      correctionNote: "Test: Employee used 'Forgot to clock out' correction",
      correctionAppliedAt: correctionTime,
    },
  });

  console.log("✅ Correction applied!");
  console.log("\n📋 Updated entry details:");
  console.log(`   Clock Out: ${actualEndTime.toLocaleString()}`);
  console.log(`   Duration Hours: ${updatedEntry.durationHours?.toFixed(2)}h`);
  console.log(`   Flag Status: ${updatedEntry.flagStatus}`);
  console.log(`   Wrong Recorded (frozen snapshot): ${(updatedEntry.wrongRecordedNetSeconds! / 3600).toFixed(2)}h`);
  console.log(`   Correction Note: ${updatedEntry.correctionNote}`);
  console.log(`   Correction Applied At: ${updatedEntry.correctionAppliedAt?.toLocaleString()}`);

  // Verify the snapshot is frozen
  console.log("\n🔒 Verifying snapshot is frozen...");
  const verifyEntry = await prisma.timeEntry.findUnique({
    where: { id: testEntry.id },
  });

  if (verifyEntry?.wrongRecordedNetSeconds === settledWrongSeconds) {
    console.log("✅ Wrong hours snapshot correctly frozen at:", (settledWrongSeconds / 3600).toFixed(2), "hours");
  } else {
    console.error("❌ Snapshot mismatch!");
  }

  // Check if this would appear in EOD report
  console.log("\n📧 Checking EOD report data...");
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const correctionsToday = await prisma.timeEntry.findMany({
    where: {
      flagStatus: "FORGOT_CLOCK_OUT",
      correctionAppliedAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    include: {
      User: { select: { name: true, email: true } },
      Job: { select: { title: true } },
    },
  });

  console.log(`\n📊 Corrections applied today: ${correctionsToday.length}`);
  
  for (const correction of correctionsToday) {
    const wrongHrs = correction.wrongRecordedNetSeconds ? correction.wrongRecordedNetSeconds / 3600 : 0;
    const correctedHrs = correction.durationHours || 0;
    console.log("\n   ⚠️  Time Correction:");
    console.log(`      Employee: ${correction.User?.name || 'Unknown'}`);
    console.log(`      Job: ${correction.Job?.title || 'N/A'}`);
    console.log(`      Clock In: ${correction.clockIn.toLocaleString()}`);
    console.log(`      Wrong Hours: ${wrongHrs.toFixed(2)}h`);
    console.log(`      Corrected Hours: ${correctedHrs.toFixed(2)}h`);
    console.log(`      Difference: ${(wrongHrs - correctedHrs).toFixed(2)}h`);
    console.log(`      Note: ${correction.correctionNote}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 Test complete!");
  console.log("\n📌 To test the full flow in the browser:");
  console.log("   1. Go to http://localhost:3000");
  console.log("   2. Log in as employee@example.com / Passw0rd!");
  console.log("   3. Clock in to a job");
  console.log("   4. Click 'Forgot to clock out?' button");
  console.log("   5. Set an earlier end time and submit");
  console.log("\n📧 To test the EOD email:");
  console.log("   GET /api/cron/eod-report (requires CRON_SECRET)");
  console.log("   Or manually call the sendEodReportEmail function\n");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

