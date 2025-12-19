"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { nowInCentral, centralToUTC } from "@/lib/date-utils";
import { createNotification } from "@/app/dashboard/notifications-actions";

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
    // Automatically clock out the previous entry before starting a new one.
    // This ends their active shift but DOES NOT move the job to AWAITING_QC.
    const prevDurationHours =
      (now.getTime() - activeEntry.clockIn.getTime()) / (1000 * 60 * 60);

    await prisma.timeEntry.update({
      where: { id: activeEntry.id },
      data: {
        clockOut: now,
        durationHours: prevDurationHours,
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

  // Create new time entry
  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      jobId: jobId || null,
      clockIn: now,
      isRework,
      clockInNotes: notes || null, // Store Clock In description separately
      breakStart: null,
      breakEnd: null,
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
  const breakMs =
    activeEntry.breakStart
      ? (activeEntry.breakEnd ? activeEntry.breakEnd.getTime() : now.getTime()) -
        activeEntry.breakStart.getTime()
      : 0;
  const durationHours = Math.max(
    (now.getTime() - activeEntry.clockIn.getTime() - Math.max(breakMs, 0)) / (1000 * 60 * 60),
    0
  );

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

  return { ok: true, entry };
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

  if (activeEntry.breakStart && !activeEntry.breakEnd) {
    return { ok: false, error: "Break already started" };
  }

  const now = centralToUTC(nowInCentral().toDate());

  const entry = await prisma.timeEntry.update({
    where: { id: activeEntry.id },
    data: { breakStart: now, breakEnd: null },
    include: { job: { select: { title: true, id: true } } },
  });

  return { ok: true, entry };
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

  if (!activeEntry.breakStart) {
    return { ok: false, error: "No break in progress" };
  }

  if (activeEntry.breakEnd) {
    return { ok: false, error: "Break already ended" };
  }

  const now = centralToUTC(nowInCentral().toDate());

  const entry = await prisma.timeEntry.update({
    where: { id: activeEntry.id },
    data: { breakEnd: now },
    include: { job: { select: { title: true, id: true } } },
  });

  return { ok: true, entry };
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

