/**
 * Full EOD Report Preview with Corrections
 * 
 * Run with: npx tsx scripts/test-eod-report-full.ts
 * 
 * This generates the actual email HTML that would be sent and saves it to a file.
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

// Import the helper functions from lib
const FlagStatus = {
  NONE: 'NONE',
  OVER_CAP: 'OVER_CAP',
  FORGOT_CLOCK_OUT: 'FORGOT_CLOCK_OUT',
} as const;

async function main() {
  console.log("\n📧 Generating Full EOD Report Preview\n");
  console.log("=".repeat(50));

  // Get organization
  const org = await prisma.organization.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  if (!org) {
    console.error("❌ No active organization found");
    return;
  }

  console.log(`Organization: ${org.name}`);

  // Get today's date range (Central Time)
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  // Get time entries for today
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      organizationId: org.id,
      clockIn: { gte: dayStart, lte: dayEnd },
    },
    include: {
      User: { select: { id: true, name: true, email: true, hourlyRate: true } },
      Job: { select: { id: true, title: true, jobNumber: true } },
    },
    orderBy: { clockIn: 'asc' },
  });

  console.log(`Found ${timeEntries.length} time entries today`);

  // Get corrections
  const corrections = await prisma.timeEntry.findMany({
    where: {
      organizationId: org.id,
      flagStatus: 'FORGOT_CLOCK_OUT',
      correctionAppliedAt: { gte: dayStart, lte: dayEnd },
    },
    include: {
      User: { select: { name: true, email: true } },
      Job: { select: { title: true, jobNumber: true } },
    },
  });

  console.log(`Found ${corrections.length} corrections today`);

  // Calculate totals
  let totalHours = 0;
  let totalLaborCost = 0;
  const employees = new Map<string, any>();
  const jobs = new Map<string, any>();

  for (const entry of timeEntries) {
    const hours = entry.durationHours || 0;
    const rate = entry.User?.hourlyRate || 0;
    totalHours += hours;
    totalLaborCost += hours * rate;

    // Group by employee
    if (!employees.has(entry.userId)) {
      employees.set(entry.userId, {
        name: entry.User?.name || 'Unknown',
        email: entry.User?.email || '',
        hours: 0,
        cost: 0,
        jobs: [],
        flags: [],
      });
    }
    const emp = employees.get(entry.userId)!;
    emp.hours += hours;
    emp.cost += hours * rate;
    if (entry.Job?.title) {
      emp.jobs.push({ title: entry.Job.title, hours });
    }
    if (entry.flagStatus && entry.flagStatus !== 'NONE') {
      emp.flags.push(entry.flagStatus);
    }

    // Group by job
    if (entry.jobId && entry.Job) {
      if (!jobs.has(entry.jobId)) {
        jobs.set(entry.jobId, {
          title: entry.Job.title,
          jobNumber: entry.Job.jobNumber,
          hours: 0,
          cost: 0,
        });
      }
      const job = jobs.get(entry.jobId)!;
      job.hours += hours;
      job.cost += hours * rate;
    }
  }

  // Format corrections for display
  const formattedCorrections = corrections.map(c => {
    const wrongHours = c.wrongRecordedNetSeconds ? c.wrongRecordedNetSeconds / 3600 : 0;
    const correctedHours = c.durationHours || 0;
    return {
      employeeName: c.User?.name || 'Unknown',
      jobTitle: c.Job?.title || 'N/A',
      clockIn: c.clockIn,
      wrongRecordedHours: wrongHours,
      correctedHours: correctedHours,
      differenceHours: wrongHours - correctedHours,
      note: c.correctionNote || 'No note',
    };
  });

  // Get admins for recipient list
  const admins = await prisma.user.findMany({
    where: {
      organizationId: org.id,
      role: { in: ['ADMIN', 'MANAGER'] },
      isVerified: true,
      status: 'APPROVED',
    },
    select: { name: true, email: true },
  });

  console.log(`\nRecipients: ${admins.map(a => a.email).join(', ')}`);

  // Generate email HTML
  const reportDate = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const flagCount = Array.from(employees.values()).reduce((sum, e) => sum + e.flags.length, 0);

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>End of Day Report - ${reportDate}</title>
  <style>
    body { margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 640px; margin: 0 auto; padding: 24px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 24px; }
    .header p { margin: 8px 0 0; color: #93c5fd; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .stat { padding: 16px; border-radius: 12px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .correction-card { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #f59e0b; }
    .employee-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .job-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; }
    .footer { background: #1f2937; border-radius: 0 0 16px 16px; padding: 24px; text-align: center; color: #9ca3af; font-size: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-success { background: #dcfce7; color: #166534; }
    .strike { text-decoration: line-through; color: #dc2626; }
  </style>
</head>
<body>
  <div class="container">
    
    <!-- Header -->
    <div class="header">
      <h1>📊 End of Day Report</h1>
      <p>${reportDate}</p>
    </div>
    
    <!-- Summary -->
    <div class="card">
      <div class="grid">
        <div class="stat" style="background: #eff6ff;">
          <div class="stat-value" style="color: #1e40af;">${totalHours.toFixed(1)}h</div>
          <div class="stat-label" style="color: #3b82f6;">Total Hours</div>
        </div>
        <div class="stat" style="background: #f0fdf4;">
          <div class="stat-value" style="color: #166534;">$${totalLaborCost.toFixed(0)}</div>
          <div class="stat-label" style="color: #22c55e;">Labor Cost</div>
        </div>
        <div class="stat" style="background: #faf5ff;">
          <div class="stat-value" style="color: #6b21a8;">${employees.size}</div>
          <div class="stat-label" style="color: #a855f7;">Employees</div>
        </div>
        <div class="stat" style="background: ${flagCount > 0 ? '#fef2f2' : '#f0fdf4'};">
          <div class="stat-value" style="color: ${flagCount > 0 ? '#991b1b' : '#166534'};">${flagCount}</div>
          <div class="stat-label" style="color: ${flagCount > 0 ? '#dc2626' : '#22c55e'};">Flags</div>
        </div>
      </div>
      
      ${corrections.length > 0 ? `
        <div style="margin-top: 16px; background: #fffbeb; padding: 12px 16px; border-radius: 8px; border: 1px solid #fcd34d; text-align: center;">
          <span style="font-size: 14px; color: #92400e;">
            ⚠️ <strong>${corrections.length}</strong> time correction(s) applied today
          </span>
        </div>
      ` : ''}
    </div>
    
    <!-- Corrections Section -->
    ${formattedCorrections.length > 0 ? `
    <div class="card" style="border: 2px solid #f59e0b;">
      <h2 class="section-title" style="color: #b45309;">
        ⚠️ Time Corrections Applied Today (Forgot to Clock Out)
      </h2>
      ${formattedCorrections.map(c => `
        <div class="correction-card">
          <div style="font-weight: 600; color: #92400e; margin-bottom: 8px; font-size: 16px;">
            ${c.employeeName}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; color: #78350f;">
            <div><strong>Job:</strong> ${c.jobTitle}</div>
            <div><strong>Clock In:</strong> ${new Date(c.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
            <div style="color: #dc2626;"><strong>Wrong Hours:</strong> <span class="strike">${c.wrongRecordedHours.toFixed(2)}h</span></div>
            <div style="color: #16a34a;"><strong>Corrected:</strong> ${c.correctedHours.toFixed(2)}h</div>
          </div>
          <div style="margin-top: 8px; padding: 8px; background: #fef3c7; border-radius: 4px; font-size: 13px;">
            <strong>Difference:</strong> ${c.differenceHours.toFixed(2)}h saved
            <br>
            <strong>Note:</strong> ${c.note}
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: #92400e; font-style: italic;">
            ✓ Applied immediately, flagged for review
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    <!-- Employees Section -->
    <div class="card">
      <h2 class="section-title">👥 Employee Summary</h2>
      ${Array.from(employees.values()).map(emp => `
        <div class="employee-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: 600;">${emp.name}</div>
            <div>
              ${emp.flags.includes('FORGOT_CLOCK_OUT') ? '<span class="badge badge-warning">⚠️ Corrected</span>' : ''}
              ${emp.flags.includes('OVER_CAP') ? '<span class="badge badge-warning">⚠️ Over Cap</span>' : ''}
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; color: #6b7280;">
            <div><strong>Hours:</strong> ${emp.hours.toFixed(2)}h</div>
            <div><strong>Cost:</strong> $${emp.cost.toFixed(2)}</div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <!-- Jobs Section -->
    <div class="card">
      <h2 class="section-title">🔧 Jobs Worked</h2>
      ${Array.from(jobs.values()).map(job => `
        <div class="job-card">
          <div>
            <div style="font-weight: 600;">${job.title}</div>
            <div style="font-size: 12px; color: #6b7280;">${job.jobNumber || 'No job number'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 600;">${job.hours.toFixed(2)}h</div>
            <div style="font-size: 12px; color: #6b7280;">$${job.cost.toFixed(2)}</div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>Shop to Field Work Management System</p>
      <p>Generated at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
    </div>
    
  </div>
</body>
</html>
  `;

  // Save to file
  const filename = 'eod-report-full-preview.html';
  writeFileSync(filename, emailHtml);
  
  console.log(`\n✅ Full EOD report saved to: ${filename}`);
  console.log("\n📊 Summary:");
  console.log(`   Total Hours: ${totalHours.toFixed(1)}h`);
  console.log(`   Labor Cost: $${totalLaborCost.toFixed(2)}`);
  console.log(`   Employees: ${employees.size}`);
  console.log(`   Jobs: ${jobs.size}`);
  console.log(`   Flags: ${flagCount}`);
  console.log(`   Corrections: ${corrections.length}`);

  if (corrections.length > 0) {
    console.log("\n⚠️  Corrections Applied:");
    for (const c of formattedCorrections) {
      console.log(`   - ${c.employeeName}: ${c.wrongRecordedHours.toFixed(2)}h → ${c.correctedHours.toFixed(2)}h (saved ${c.differenceHours.toFixed(2)}h)`);
    }
  }

  console.log("\n🌐 Open the HTML file in a browser to preview the email!");
  console.log("\n📧 To enable actual email sending:");
  console.log("   1. Get a Resend API key from https://resend.com");
  console.log("   2. Add RESEND_API_KEY to your .env file");
  console.log("   3. Restart the dev server");
  console.log("   4. Call /api/cron/eod-report without dry_run");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

