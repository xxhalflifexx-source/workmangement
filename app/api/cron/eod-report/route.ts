/**
 * Cron job API route for sending End-of-Day email reports.
 * 
 * This endpoint should be called daily at 6 PM Central by:
 * - Vercel Cron Jobs
 * - External cron service (e.g., cron-job.org)
 * - Internal scheduler
 * 
 * It generates and sends daily reports for all active organizations.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateEodReport,
  getEodReportRecipients,
  formatReportPreview,
} from "@/lib/eod-report-service";
import { sendEodReportEmail } from "@/lib/email";

// Vercel cron secret for authentication (optional but recommended)
const CRON_SECRET = process.env.CRON_SECRET;

interface ReportResult {
  organizationId: string;
  organizationName: string;
  status: "sent" | "skipped" | "failed";
  recipients?: string[];
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    if (CRON_SECRET) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // Check for dry-run mode (useful for testing)
    const searchParams = request.nextUrl.searchParams;
    const dryRun = searchParams.get("dry_run") === "true";
    const orgIdFilter = searchParams.get("org_id");

    // Get all active organizations
    const organizations = await prisma.organization.findMany({
      where: {
        isActive: true,
        ...(orgIdFilter ? { id: orgIdFilter } : {}),
      },
      select: { id: true, name: true },
    });

    if (organizations.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active organizations found",
        results: [],
      });
    }

    const results: ReportResult[] = [];

    for (const org of organizations) {
      try {
        // Generate report data
        const reportData = await generateEodReport(org.id);

        // Skip if no activity today
        if (reportData.summary.employeeCount === 0 && reportData.summary.jobCount === 0) {
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            status: "skipped",
            error: "No activity today",
          });
          continue;
        }

        // Get recipients
        const recipients = await getEodReportRecipients(org.id);

        if (recipients.length === 0) {
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            status: "skipped",
            error: "No admin recipients found",
          });
          continue;
        }

        // In dry-run mode, just log the preview
        if (dryRun) {
          console.log(`\n--- DRY RUN: ${org.name} ---`);
          console.log(formatReportPreview(reportData));
          console.log(`Would send to: ${recipients.join(", ")}`);
          
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            status: "skipped",
            recipients,
            error: "Dry run - email not sent",
          });
          continue;
        }

        // Send the email
        const emailResult = await sendEodReportEmail(
          recipients,
          reportData.reportDate,
          reportData.organizationName,
          reportData.summary,
          reportData.employees.map(e => ({
            name: e.name,
            email: e.email,
            netWorkHours: e.netWorkHours,
            breakHours: e.breakHours,
            paidHours: e.paidHours,
            hourlyRate: e.hourlyRate,
            laborCost: e.laborCost,
            workDescription: e.workDescription,
            jobsWorked: e.jobsWorked.map(j => ({ title: j.title, hours: j.hours })),
            flags: e.flags,
          })),
          reportData.jobs.map(j => ({
            title: j.title,
            jobNumber: j.jobNumber,
            revenue: j.revenue,
            revenueSource: j.revenueSource,
            costToday: j.costToday,
            costToDate: j.costToDate,
            profit: j.profit,
            margin: j.margin,
            status: j.status,
            alerts: j.alerts,
          })),
          reportData.exceptions
        );

        if (emailResult.success) {
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            status: "sent",
            recipients,
          });
        } else {
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            status: "failed",
            recipients,
            error: String(emailResult.error),
          });
        }
      } catch (orgError) {
        console.error(`Error processing org ${org.name}:`, orgError);
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          status: "failed",
          error: orgError instanceof Error ? orgError.message : String(orgError),
        });
      }
    }

    const sent = results.filter(r => r.status === "sent").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const failed = results.filter(r => r.status === "failed").length;

    return NextResponse.json({
      success: true,
      message: `EOD reports: ${sent} sent, ${skipped} skipped, ${failed} failed`,
      dryRun,
      results,
    });
  } catch (error) {
    console.error("EOD Report cron error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}

