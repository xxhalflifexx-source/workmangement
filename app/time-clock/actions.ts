"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function clockIn(jobId?: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;

  const now = new Date();

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
    },
    include: {
      job: { select: { title: true, id: true } },
    },
  });

  return { ok: true, entry };
}

export async function clockOut(notes?: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;

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

  const now = new Date();
  const durationHours =
    (now.getTime() - activeEntry.clockIn.getTime()) / (1000 * 60 * 60);

  // Update with clock out time and computed duration
  const entry = await prisma.timeEntry.update({
    where: { id: activeEntry.id },
    data: {
      clockOut: now,
      durationHours,
      notes: notes || null,
    },
  });

  // Create JobActivity if this was linked to a job and has notes
  if (activeEntry.jobId && notes) {
    try {
      await prisma.jobActivity.create({
        data: {
          jobId: activeEntry.jobId,
          userId,
          type: "TIME_ENTRY",
          timeEntryId: entry.id,
          notes: notes || null,
        },
      });
    } catch (error) {
      console.error("Failed to create job activity:", error);
      // Don't fail the clock out if activity creation fails
    }
  }

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
        : { assignedTo: userId, status: { in: allowedStatuses } },
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

  // Get jobs specifically assigned to this user
  const jobs = await prisma.job.findMany({
    where: {
      assignedTo: userId,
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

