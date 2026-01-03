/**
 * Cron job API route for evaluating soft cap on open time entries.
 * 
 * This endpoint should be called periodically (e.g., every 5 minutes) by:
 * - Vercel Cron Jobs
 * - External cron service (e.g., cron-job.org)
 * - Internal scheduler
 * 
 * It checks all open time entries and flags any that have exceeded
 * 16 hours of net work time (breaks excluded).
 */

import { NextRequest, NextResponse } from "next/server";
import { evaluateSoftCapForOpenEntries } from "@/app/time-clock/actions";

// Vercel cron secret for authentication (optional but recommended)
const CRON_SECRET = process.env.CRON_SECRET;

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

    // Run the soft cap evaluation
    const result = await evaluateSoftCapForOpenEntries();

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} entries, flagged ${result.flagged}`,
      ...result,
    });
  } catch (error) {
    console.error("Cron soft cap evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}

