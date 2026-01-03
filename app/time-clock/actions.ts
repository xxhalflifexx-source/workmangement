"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { nowInCentral, centralToUTC } from "@/lib/date-utils";
import { createNotification } from "@/app/dashboard/notifications-actions";
import {
  TimeEntryState,
  FlagStatus,
  createInitialCapFields,
  prepareStartBreak,
  prepareEndBreak,
  prepareClockOut,
  getNetWorkSeconds,
  getEffectiveNetWorkHours,
  applySoftCapFlag,
  isApproachingCap,
  type TimeEntryWithCap,
  type MutableTimeEntry,
} from "@/lib/time-entry-cap";

// Set timezone for Node.js process
if (typeof process !== "undefined") {
  process.env.TZ = "America/Chicago";
}

export async function clockIn(jobId?: string, notes?: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const organizationId = (session.user as any).organizationId;

  // Get current time in Central Time, then convert to UTC for database storage
  const nowCentral = nowInCentral();
  const now = centralToUTC(nowCentral.toDate());

  // Check if already clocked in on another job.
  // Business rule: at most ONE active TimeEntry per user.
  const activeEntry = await prisma.timeEntry.findFirst({
    where: {
      userId,
      clockOut: null,
    },
  });

  if (activeEntry) {
    // Check if previous entry is flagged OVER_CAP - require resolution before new clock-in
    if (activeEntry.flagStatus === FlagStatus.OVER_CAP) {
      return { 
        ok: false, 
        error: "Your previous time entry exceeded 16 hours net work time and requires review. Please contact a manager to resolve it before clocking in again.",
        flaggedEntryId: activeEntry.id
      };
    }

    // Automatically clock out the previous entry before starting a new one.
    // This ends their active shift but DOES NOT move the job to AWAITING_QC.
    // Use the soft cap logic for proper clock out
    const entryWithCap = activeEntry as unknown as MutableTimeEntry;
    prepareClockOut(entryWithCap, now);
    
    const durationHours = entryWithCap.workAccumSeconds / 3600;

    await prisma.timeEntry.update({
      where: { id: activeEntry.id },
      data: {
        clockOut: now,
        durationHours,
        state: TimeEntryState.CLOCKED_OUT,
        workAccumSeconds: entryWithCap.workAccumSeconds,
        lastStateChangeAt: now,
        flagStatus: entryWithCap.flagStatus,
        overCapAt: entryWithCap.overCapAt,
      },
    });
  }

  // If clocking into a specific job, update its status based on lifecycle rules.
  let isRework = false;
  if (jobId) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    if (job) {
      // Any work performed while a job is in REWORK is counted as rework time.
      isRework = job.status === "REWORK";

      if (job.status === "NOT_STARTED" || job.status === "PENDING") {
        await prisma.job.update({
          where: { id: jobId },
          data: { status: "IN_PROGRESS" },
        });
      }
    }
  }

  // Create initial cap fields for the new entry
  const capFields = createInitialCapFields(now);

  // Create new time entry with soft cap fields
  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      organizationId: organizationId || null,
      jobId: jobId || null,
      clockIn: now,
      isRework,
      clockInNotes: notes || null, // Store Clock In description separately
      breakStart: null,
      breakEnd: null,
      // Soft cap fields
      state: capFields.state,
      workAccumSeconds: capFields.workAccumSeconds,
      lastStateChangeAt: capFields.lastStateChangeAt,
      capMinutes: capFields.capMinutes,
      flagStatus: capFields.flagStatus,
      overCapAt: capFields.overCapAt,
    },
    include: {
      job: { select: { title: true, id: true } },
      user: { select: { name: true } },
    },
  });

  // Create notifications for HR/Admin/Manager users when employee clocks in
  try {
    const hrUsers = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "MANAGER"] },
        isVerified: true,
        status: "APPROVED",
      },
      select: { id: true },
    });

    const employeeName = entry.user.name || "An employee";
    const jobTitle = entry.job?.title ? ` for job: ${entry.job.title}` : "";

    // Create notification for each HR/Admin/Manager
    for (const hrUser of hrUsers) {
      await createNotification(
        hrUser.id,
        "Employee Clocked In",
        `${employeeName} has clocked in${jobTitle}`,
        "INFO",
        "/hr"
      );
    }
  } catch (error) {
    // Don't fail clock-in if notification creation fails
    console.error("Failed to create clock-in notifications:", error);
  }

  return { ok: true, entry };
}

export async function clockOut(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const notes = formData.get("notes")?.toString() || undefined;
  const imagePathsJson = formData.get("imagePaths")?.toString();

  // Find active entry
  const activeEntry = await prisma.timeEntry.findFirst({
    where: {
      userId,
      clockOut: null,
    },
  });

  if (!activeEntry) {
    return { ok: false, error: "Not clocked in" };
  }

  // Get current time in Central Time, then convert to UTC for database storage
  const nowCentral = nowInCentral();
  const now = centralToUTC(nowCentral.toDate());
  
  // Use soft cap logic for clock out
  const entryWithCap = activeEntry as unknown as MutableTimeEntry;
  
  // If currently on break, end break first (auto-close the break)
  if (entryWithCap.state === TimeEntryState.ON_BREAK) {
    prepareEndBreak(entryWithCap, now);
  }
  
  // Apply clock out logic with soft cap
  prepareClockOut(entryWithCap, now);
  
  // Calculate duration from accumulated work seconds
  const durationHours = entryWithCap.workAccumSeconds / 3600;

  // Parse image paths if provided
  let imagePaths: string[] = [];
  if (imagePathsJson) {
    try {
      imagePaths = JSON.parse(imagePathsJson);
    } catch (error) {
      console.error("Failed to parse image paths:", error);
    }
  }

  // Update with clock out time and computed duration
  const entry = await prisma.timeEntry.update({
    where: { id: activeEntry.id },
    data: {
      clockOut: now,
      durationHours,
      notes: notes || null,
      breakEnd: activeEntry.breakStart && !activeEntry.breakEnd ? now : activeEntry.breakEnd,
      // Store images in TimeEntry if no jobId (for non-job clock-ins)
      images: !activeEntry.jobId && imagePaths.length > 0 ? JSON.stringify(imagePaths) : activeEntry.images,
      // Soft cap fields
      state: entryWithCap.state,
      workAccumSeconds: entryWithCap.workAccumSeconds,
      lastStateChangeAt: entryWithCap.lastStateChangeAt,
      flagStatus: entryWithCap.flagStatus,
      overCapAt: entryWithCap.overCapAt,
    },
  });

  // If clocked in with a job, create JobActivity with photos
  if (activeEntry.jobId) {
    try {
      await prisma.jobActivity.create({
        data: {
          jobId: activeEntry.jobId,
          userId,
          type: "TIME_ENTRY",
          timeEntryId: entry.id,
          notes: notes || null,
          // Store images in JobActivity for job-related clock-outs
          images: imagePaths.length > 0 ? JSON.stringify(imagePaths) : null,
        },
      });
    } catch (error) {
      console.error("Failed to create job activity:", error);
      // Don't fail the clock out if activity creation fails
    }
  }

  // Return info about flag status
  return { 
    ok: true, 
    entry,
    isOverCap: entryWithCap.flagStatus === FlagStatus.OVER_CAP,
  };
}

export async function startBreak() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;

  const activeEntry = await prisma.timeEntry.findFirst({
    where: { userId, clockOut: null },
  });

  if (!activeEntry) {
    return { ok: false, error: "Not clocked in" };
  }

  // Check state instead of breakStart/breakEnd for soft cap compatibility
  if (activeEntry.state === TimeEntryState.ON_BREAK) {
    return { ok: false, error: "Break already started" };
  }

  const now = centralToUTC(nowInCentral().toDate());

  // Use soft cap logic - settles work time before transitioning to break
  const entryWithCap = activeEntry as unknown as MutableTimeEntry;
  prepareStartBreak(entryWithCap, now);
  
  // Check if approaching cap and send notification
  const netWorkSeconds = entryWithCap.workAccumSeconds;
  const capSeconds = entryWithCap.capMinutes * 60;
  const isNearCap = netWorkSeconds >= (capSeconds - 30 * 60); // Within 30 minutes

  const entry = await prisma.timeEntry.update({
    where: { id: activeEntry.id },
    data: { 
      breakStart: now, 
      breakEnd: null,
      // Soft cap fields
      state: entryWithCap.state,
      workAccumSeconds: entryWithCap.workAccumSeconds,
      lastStateChangeAt: entryWithCap.lastStateChangeAt,
    },
    include: { job: { select: { title: true, id: true } } },
  });

  return { 
    ok: true, 
    entry,
    netWorkSeconds: entryWithCap.workAccumSeconds,
    isNearCap,
  };
}

export async function endBreak() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;

  const activeEntry = await prisma.timeEntry.findFirst({
    where: { userId, clockOut: null },
  });

  if (!activeEntry) {
    return { ok: false, error: "Not clocked in" };
  }

  // Check state instead of breakStart/breakEnd for soft cap compatibility
  if (activeEntry.state !== TimeEntryState.ON_BREAK) {
    return { ok: false, error: "No break in progress" };
  }

  const now = centralToUTC(nowInCentral().toDate());

  // Use soft cap logic - sets state back to WORKING
  const entryWithCap = activeEntry as unknown as MutableTimeEntry;
  prepareEndBreak(entryWithCap, now);
  
  // Apply soft cap flag check after resuming work
  applySoftCapFlag(entryWithCap, now);

  const entry = await prisma.timeEntry.update({
    where: { id: activeEntry.id },
    data: { 
      breakEnd: now,
      // Soft cap fields
      state: entryWithCap.state,
      lastStateChangeAt: entryWithCap.lastStateChangeAt,
      flagStatus: entryWithCap.flagStatus,
      overCapAt: entryWithCap.overCapAt,
    },
    include: { job: { select: { title: true, id: true } } },
  });

  return { 
    ok: true, 
    entry,
    isOverCap: entryWithCap.flagStatus === FlagStatus.OVER_CAP,
  };
}

export async function getCurrentStatus() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;

  const activeEntry = await prisma.timeEntry.findFirst({
    where: {
      userId,
      clockOut: null,
    },
    include: {
      job: { select: { title: true, id: true } },
    },
  });

  // If there's an active entry, compute current net work time
  if (activeEntry) {
    const now = centralToUTC(nowInCentral().toDate());
    const entryWithCap = activeEntry as unknown as TimeEntryWithCap;
    const netWorkSeconds = getNetWorkSeconds(entryWithCap, now);
    const capSeconds = entryWithCap.capMinutes * 60;
    const isNearCap = isApproachingCap(entryWithCap, now);
    const isOverCap = entryWithCap.flagStatus === FlagStatus.OVER_CAP || netWorkSeconds >= capSeconds;
    
    return { 
      ok: true, 
      activeEntry,
      softCap: {
        netWorkSeconds,
        netWorkHours: netWorkSeconds / 3600,
        capMinutes: entryWithCap.capMinutes,
        capSeconds,
        isNearCap,
        isOverCap,
        flagStatus: entryWithCap.flagStatus,
        state: entryWithCap.state,
      }
    };
  }

  return { ok: true, activeEntry };
}

export async function getTodayEntries() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
      clockIn: {
        gte: today,
      },
    },
    include: {
      job: { select: { title: true, id: true } },
    },
    orderBy: {
      clockIn: "desc",
    },
  });

  return { ok: true, entries };
}

export async function getRecentEntries(limit: number = 10) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
    },
    include: {
      job: { select: { title: true, id: true } },
    },
    orderBy: {
      clockIn: "desc",
    },
    take: limit,
  });

  return { ok: true, entries };
}

export async function getAvailableJobs() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  // Get jobs assigned to user or all jobs if manager/admin.
  // Employees can clock into jobs that are NOT_STARTED, IN_PROGRESS, or REWORK.
  const allowedStatuses = ["NOT_STARTED", "PENDING", "IN_PROGRESS", "REWORK"];

  const jobs = await prisma.job.findMany({
    where:
      userRole === "ADMIN" || userRole === "MANAGER"
        ? { status: { in: allowedStatuses } }
        : {
            OR: [
              { assignedTo: userId }, // Old single assignment
              { assignments: { some: { userId } } }, // New multiple assignments
            ],
            status: { in: allowedStatuses },
          },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
    },
    orderBy: {
      priority: "desc",
    },
  });

  return { ok: true, jobs };
}

export async function getAssignedJobs() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;

  // Get jobs specifically assigned to this user (via old or new system)
  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { assignedTo: userId }, // Old single assignment
        { assignments: { some: { userId } } }, // New multiple assignments
      ],
      status: { in: ["NOT_STARTED", "PENDING", "IN_PROGRESS", "REWORK"] },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
    },
    orderBy: [
      { priority: "desc" },
      { dueDate: "asc" },
    ],
  });

  return { ok: true, jobs };
}

export async function getPayPeriodSummary() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const organizationId = (session.user as any).organizationId;

  try {
    // Get user's hourly rate, lastPaidDate, and payroll settings
    const [user, companySettings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
      }),
      organizationId
        ? prisma.companySettings.findFirst({
            where: { organizationId },
          })
        : null,
    ]);

    const userData = user as any; // Type assertion for lastPaidDate
    const lastPaidDate = userData?.lastPaidDate ? new Date(userData.lastPaidDate) : null;

    // Calculate pay period dates
    const cs = companySettings as any;
    const paySettings = {
      payPeriodType: cs?.payPeriodType ?? "weekly",
      payDay: cs?.payDay ?? "friday",
      payPeriodStartDate: cs?.payPeriodStartDate,
      overtimeEnabled: cs?.overtimeEnabled ?? false,
      overtimeType: cs?.overtimeType ?? "weekly40",
      overtimeRate: cs?.overtimeRate ?? 1.5,
    };

    // Simple period calculation (Friday to Friday weekly)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const payDayNum = dayMap[paySettings.payDay] ?? 5;
    
    // Find the next pay day
    let daysUntilPayDay = payDayNum - dayOfWeek;
    if (daysUntilPayDay < 0) daysUntilPayDay += 7;
    
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + daysUntilPayDay);
    periodEnd.setHours(23, 59, 59, 999);
    
    const periodDays = paySettings.payPeriodType === "biweekly" ? 14 : 7;
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - periodDays + 1);
    periodStart.setHours(0, 0, 0, 0);

    // Use lastPaidDate if it's more recent than period start (to show owed since last payment)
    const owedSinceDate = lastPaidDate && lastPaidDate > periodStart ? lastPaidDate : periodStart;

    // Get time entries since last payment (what's owed)
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId,
        clockIn: {
          gt: owedSinceDate, // Greater than last paid date
          lte: periodEnd,
        },
        clockOut: { not: null }, // Only completed entries
      },
      select: {
        clockIn: true,
        clockOut: true,
        durationHours: true,
      },
    });

    // Calculate total hours
    let totalHours = 0;
    const hoursByDay: Record<string, number> = {};

    entries.forEach((entry) => {
      const hours = entry.durationHours || 0;
      totalHours += hours;
      
      const dayKey = entry.clockIn.toISOString().split("T")[0];
      hoursByDay[dayKey] = (hoursByDay[dayKey] || 0) + hours;
    });

    // Calculate overtime if enabled
    let regularHours = totalHours;
    let overtimeHours = 0;

    if (paySettings.overtimeEnabled) {
      if (paySettings.overtimeType === "weekly40" && totalHours > 40) {
        regularHours = 40;
        overtimeHours = totalHours - 40;
      } else if (paySettings.overtimeType === "daily8") {
        regularHours = 0;
        overtimeHours = 0;
        Object.values(hoursByDay).forEach((dayHours) => {
          if (dayHours <= 8) {
            regularHours += dayHours;
          } else {
            regularHours += 8;
            overtimeHours += dayHours - 8;
          }
        });
      }
    }

    // Calculate pay
    const hourlyRate = userData?.hourlyRate || 0;
    const regularPay = regularHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate * paySettings.overtimeRate;
    const totalPay = regularPay + overtimePay;

    // Format period label - show "since last payment" if applicable
    const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const isOwedSincePayment = lastPaidDate && lastPaidDate > periodStart;
    const periodLabel = isOwedSincePayment 
      ? `Since ${formatDate(lastPaidDate)}` 
      : `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;

    return {
      ok: true,
      summary: {
        periodLabel,
        periodStart: owedSinceDate.toISOString(),
        periodEnd: periodEnd.toISOString(),
        totalHours: Math.round(totalHours * 100) / 100,
        regularHours: Math.round(regularHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        hourlyRate,
        regularPay: Math.round(regularPay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        totalPay: Math.round(totalPay * 100) / 100,
        overtimeEnabled: paySettings.overtimeEnabled,
        overtimeRate: paySettings.overtimeRate,
        lastPaidDate: lastPaidDate?.toISOString() || null,
      },
    };
  } catch (error) {
    console.error("Get pay period summary error:", error);
    return { ok: false, error: "Failed to get pay period summary" };
  }
}

/**
 * Evaluate soft cap for all open time entries.
 * This is called by the background job to flag entries that have exceeded 16h net work time.
 * Does NOT auto-clock-out any entries.
 * 
 * @returns Object with flagged entry count and any errors
 */
export async function evaluateSoftCapForOpenEntries() {
  const now = centralToUTC(nowInCentral().toDate());
  
  try {
    // Find all open entries that are not already flagged as OVER_CAP
    const openEntries = await prisma.timeEntry.findMany({
      where: {
        clockOut: null,
        flagStatus: { not: FlagStatus.OVER_CAP },
      },
      select: {
        id: true,
        userId: true,
        state: true,
        workAccumSeconds: true,
        lastStateChangeAt: true,
        capMinutes: true,
        flagStatus: true,
        overCapAt: true,
      },
    });

    let flaggedCount = 0;
    const errors: string[] = [];

    for (const entry of openEntries) {
      try {
        const entryWithCap = entry as unknown as MutableTimeEntry;
        const netWorkSeconds = getNetWorkSeconds(entryWithCap, now);
        const capSeconds = entryWithCap.capMinutes * 60;
        
        if (netWorkSeconds >= capSeconds) {
          // Apply soft cap flag
          applySoftCapFlag(entryWithCap, now);
          
          // Update in database
          await prisma.timeEntry.update({
            where: { id: entry.id },
            data: {
              flagStatus: entryWithCap.flagStatus,
              overCapAt: entryWithCap.overCapAt,
            },
          });
          
          flaggedCount++;
          
          // Create notification for the user
          try {
            await createNotification(
              entry.userId,
              "Time Entry Over 16 Hours",
              "Your active time entry has exceeded 16 hours of net work time (breaks excluded). Please clock out or contact a manager.",
              "WARNING",
              "/time-clock"
            );
            
            // Also notify managers/admins
            const managers = await prisma.user.findMany({
              where: {
                role: { in: ["ADMIN", "MANAGER"] },
                isVerified: true,
                status: "APPROVED",
              },
              select: { id: true },
            });
            
            for (const manager of managers) {
              await createNotification(
                manager.id,
                "Employee Time Entry Flagged",
                `A time entry has exceeded 16 hours of net work time and requires review.`,
                "WARNING",
                "/hr"
              );
            }
          } catch (notifError) {
            // Don't fail the cap evaluation if notification fails
            console.error("Failed to create over-cap notification:", notifError);
          }
        }
      } catch (entryError) {
        const errorMsg = `Failed to evaluate entry ${entry.id}: ${entryError}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return {
      ok: true,
      processed: openEntries.length,
      flagged: flaggedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("Soft cap evaluation error:", error);
    return { ok: false, error: "Failed to evaluate soft cap" };
  }
}

/**
 * Get all flagged time entries for admin review.
 * 
 * @returns List of flagged entries with user details
 */
export async function getFlaggedTimeEntries() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "MANAGER") {
    return { ok: false, error: "Not authorized" };
  }

  try {
    const flaggedEntries = await prisma.timeEntry.findMany({
      where: {
        flagStatus: FlagStatus.OVER_CAP,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true } },
      },
      orderBy: { overCapAt: "asc" },
    });

    return { ok: true, entries: flaggedEntries };
  } catch (error) {
    console.error("Get flagged entries error:", error);
    return { ok: false, error: "Failed to get flagged entries" };
  }
}

/**
 * Resolve a flagged time entry (admin action).
 * Sets flagStatus to RESOLVED.
 * 
 * @param entryId The time entry ID to resolve
 * @param resolution Optional resolution notes
 * @returns Success/failure result
 */
export async function resolveFlaggedEntry(entryId: string, resolution?: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "MANAGER") {
    return { ok: false, error: "Not authorized" };
  }

  try {
    const entry = await prisma.timeEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      return { ok: false, error: "Entry not found" };
    }

    if (entry.flagStatus !== FlagStatus.OVER_CAP) {
      return { ok: false, error: "Entry is not flagged as OVER_CAP" };
    }

    await prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        flagStatus: FlagStatus.RESOLVED,
        // Optionally append resolution note
        notes: resolution 
          ? `${entry.notes || ""}\n[RESOLVED: ${resolution}]`.trim()
          : entry.notes,
      },
    });

    return { ok: true };
  } catch (error) {
    console.error("Resolve flagged entry error:", error);
    return { ok: false, error: "Failed to resolve entry" };
  }
}

