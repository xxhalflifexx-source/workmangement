/**
 * Test script to preview the EOD report email with forgot-clock-out corrections
 * 
 * Run with: npx tsx scripts/test-eod-email-preview.ts
 * 
 * This generates the HTML email content and saves it to a file for preview.
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

async function main() {
  console.log("\n📧 Generating EOD Email Preview with Corrections\n");
  console.log("=".repeat(50));

  // Get today's date range
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Get corrections for today
  const corrections = await prisma.timeEntry.findMany({
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

  console.log(`Found ${corrections.length} corrections today`);

  // Get all time entries for today
  const allEntries = await prisma.timeEntry.findMany({
    where: {
      clockIn: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    include: {
      User: { select: { name: true } },
      Job: { select: { title: true, estimatedHours: true } },
    },
  });

  // Calculate totals
  const totalLaborHours = allEntries.reduce((sum, e) => sum + (e.durationHours || 0), 0);
  const uniqueEmployees = new Set(allEntries.map(e => e.userId)).size;
  const uniqueJobs = new Set(allEntries.filter(e => e.jobId).map(e => e.jobId)).size;
  const flagCount = allEntries.filter(e => e.flagStatus !== "NONE").length;

  // Generate email HTML
  const reportDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const correctionsHtml = corrections.length > 0 ? `
    <div style="margin: 24px 0; padding: 20px; background: #fffbeb; border: 2px solid #f59e0b; border-radius: 12px;">
      <h2 style="margin: 0 0 16px 0; color: #b45309; font-size: 18px;">
        ⚠️ Time Corrections Applied Today (Forgot to Clock Out)
      </h2>
      ${corrections.map(correction => {
        const wrongHrs = correction.wrongRecordedNetSeconds ? correction.wrongRecordedNetSeconds / 3600 : 0;
        const correctedHrs = correction.durationHours || 0;
        return `
          <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #f59e0b;">
            <div style="font-weight: 600; color: #92400e; margin-bottom: 8px; font-size: 16px;">
              ${correction.User?.name || 'Unknown Employee'}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; color: #78350f;">
              <div><strong>Job:</strong> ${correction.Job?.title || 'N/A'}</div>
              <div><strong>Clock In:</strong> ${correction.clockIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
              <div style="color: #dc2626;"><strong>Wrong Hours:</strong> <s>${wrongHrs.toFixed(2)}h</s></div>
              <div style="color: #16a34a;"><strong>Corrected Hours:</strong> ${correctedHrs.toFixed(2)}h</div>
            </div>
            <div style="margin-top: 8px; padding: 8px; background: #fef3c7; border-radius: 4px; font-size: 13px;">
              <strong>Difference:</strong> ${(wrongHrs - correctedHrs).toFixed(2)}h saved
              <br>
              <strong>Note:</strong> ${correction.correctionNote || 'No note provided'}
            </div>
            <div style="margin-top: 8px; font-size: 11px; color: #92400e; font-style: italic;">
              ✓ Applied immediately, flagged for review
            </div>
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>End of Day Report - ${reportDate}</title>
</head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; padding: 24px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
        📊 End of Day Report
      </h1>
      <p style="margin: 8px 0 0 0; color: #93c5fd; font-size: 14px;">
        ${reportDate}
      </p>
    </div>
    
    <!-- Summary Cards -->
    <div style="background: white; padding: 24px; border-bottom: 1px solid #e5e7eb;">
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
        <div style="background: #eff6ff; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: #1e40af;">${totalLaborHours.toFixed(1)}h</div>
          <div style="font-size: 12px; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px;">Total Hours</div>
        </div>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: #166534;">${uniqueEmployees}</div>
          <div style="font-size: 12px; color: #22c55e; text-transform: uppercase; letter-spacing: 0.5px;">Employees</div>
        </div>
        <div style="background: #faf5ff; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: #6b21a8;">${uniqueJobs}</div>
          <div style="font-size: 12px; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px;">Jobs Worked</div>
        </div>
        <div style="background: ${flagCount > 0 ? '#fef2f2' : '#f0fdf4'}; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: ${flagCount > 0 ? '#991b1b' : '#166534'};">${flagCount}</div>
          <div style="font-size: 12px; color: ${flagCount > 0 ? '#dc2626' : '#22c55e'}; text-transform: uppercase; letter-spacing: 0.5px;">Flags</div>
        </div>
      </div>
      
      <!-- Corrections Count -->
      ${corrections.length > 0 ? `
        <div style="margin-top: 16px; background: #fffbeb; padding: 12px 16px; border-radius: 8px; border: 1px solid #fcd34d; text-align: center;">
          <span style="font-size: 14px; color: #92400e;">
            ⚠️ <strong>${corrections.length}</strong> time correction(s) applied today
          </span>
        </div>
      ` : ''}
    </div>
    
    <!-- Corrections Section -->
    <div style="background: white; padding: 24px;">
      ${correctionsHtml || '<p style="color: #6b7280; text-align: center;">No time corrections today.</p>'}
    </div>
    
    <!-- Footer -->
    <div style="background: #1f2937; border-radius: 0 0 16px 16px; padding: 24px; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        Shop to Field Work Management System
        <br>
        Generated at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
    
  </div>
</body>
</html>
  `;

  // Save to file for preview
  const filename = 'eod-email-preview.html';
  writeFileSync(filename, emailHtml);
  
  console.log(`\n✅ Email preview saved to: ${filename}`);
  console.log("\n📋 Summary:");
  console.log(`   Total Labor Hours: ${totalLaborHours.toFixed(1)}h`);
  console.log(`   Employees: ${uniqueEmployees}`);
  console.log(`   Jobs: ${uniqueJobs}`);
  console.log(`   Flags: ${flagCount}`);
  console.log(`   Corrections: ${corrections.length}`);
  console.log("\n🌐 Open the HTML file in a browser to preview the email!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

