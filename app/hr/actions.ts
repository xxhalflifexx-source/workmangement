"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { startOfDayCentral, endOfDayCentral, parseCentralDate } from "@/lib/date-utils";
import bcrypt from "bcryptjs";

// Set timezone for Node.js process
if (typeof process !== "undefined") {
  process.env.TZ = "America/Chicago";
}

export async function getAllUsersStats(dateFrom?: string, dateTo?: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only managers and admins can access HR data
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only managers and admins can access HR" };
  }

  try {
    // Parse date range if provided
    let dateFromDate: Date | undefined;
    let dateToDate: Date | undefined;

    if (dateFrom) {
      dateFromDate = startOfDayCentral(parseCentralDate(dateFrom));
    }

    if (dateTo) {
      dateToDate = endOfDayCentral(parseCentralDate(dateTo));
    }

    // Try to fetch with clockInNotes, fallback if column doesn't exist
    let users;
    try {
      users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          timeEntries: {
            select: {
              id: true,
              clockIn: true,
              clockOut: true,
              breakStart: true,
              breakEnd: true,
              clockInNotes: true,
              notes: true,
              job: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
            orderBy: {
              clockIn: "desc",
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
    } catch (error: any) {
      // If clockInNotes column doesn't exist, fetch without it
      if (error?.code === 'P2022' || error?.message?.includes('clockInNotes')) {
        users = await prisma.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          timeEntries: {
            select: {
              id: true,
              clockIn: true,
              clockOut: true,
              breakStart: true,
              breakEnd: true,
              notes: true,
              job: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
            orderBy: {
              clockIn: "desc",
            },
          },
          },
          orderBy: {
            name: "asc",
          },
        });
        // Add null clockInNotes to all entries
        users = users.map((user: any) => ({
          ...user,
          timeEntries: user.timeEntries.map((entry: any) => ({
            ...entry,
            clockInNotes: null,
          })),
        }));
      } else {
        throw error;
      }
    }

    // Calculate stats for each user
    const usersWithStats = users.map((user) => {
      let dateRangeHours = 0;
      let completedShifts = 0;
      let thisWeekHours = 0;
      let thisMonthHours = 0;

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      user.timeEntries.forEach((entry: any) => {
        if (entry.clockIn && entry.clockOut) {
          const clockInDate = new Date(entry.clockIn);
          const breakMs = entry.breakStart
            ? (entry.breakEnd ? new Date(entry.breakEnd).getTime() : new Date(entry.clockOut).getTime()) -
              new Date(entry.breakStart).getTime()
            : 0;
          const duration = new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime() - Math.max(breakMs, 0);
          const hours = duration / (1000 * 60 * 60);
          
          // Check if entry is within date range
          let isInDateRange = false;
          if (dateFromDate && dateToDate) {
            isInDateRange = clockInDate >= dateFromDate && clockInDate <= dateToDate;
          } else if (dateFromDate) {
            isInDateRange = clockInDate >= dateFromDate;
          } else if (dateToDate) {
            isInDateRange = clockInDate <= dateToDate;
          } else {
            // If no date range specified, default to this week
            isInDateRange = clockInDate >= startOfWeek;
          }

          // Only count shifts and hours within the selected date range
          if (isInDateRange) {
            completedShifts++;
            dateRangeHours += hours;
          }

          // Keep this week and this month for reference (not used in main display)
          if (clockInDate >= startOfWeek) {
            thisWeekHours += hours;
          }
          if (clockInDate >= startOfMonth) {
            thisMonthHours += hours;
          }
        }
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        dateRangeHours: Math.round(dateRangeHours * 10) / 10,
        completedShifts,
        thisWeekHours: Math.round(thisWeekHours * 10) / 10,
        thisMonthHours: Math.round(thisMonthHours * 10) / 10,
        recentEntries: user.timeEntries.slice(0, 5),
      };
    });

    return { ok: true, users: usersWithStats };
  } catch (error) {
    console.error("Get users stats error:", error);
    return { ok: false, error: "Failed to fetch user stats" };
  }
}

export async function getUserTimeEntries(userId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only managers and admins can access HR data
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    // Try to fetch with clockInNotes, fallback if column doesn't exist
    let entries;
    try {
      entries = await prisma.timeEntry.findMany({
        where: { userId },
        select: {
          id: true,
          clockIn: true,
          clockOut: true,
          breakStart: true,
          breakEnd: true,
          clockInNotes: true,
          notes: true,
          images: true,
          job: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          clockIn: "desc",
        },
        take: 50,
      });
    } catch (error: any) {
      // If clockInNotes column doesn't exist, fetch without it
      if (error?.code === 'P2022' || error?.message?.includes('clockInNotes')) {
        entries = await prisma.timeEntry.findMany({
          where: { userId },
          select: {
            id: true,
            clockIn: true,
            clockOut: true,
            breakStart: true,
            breakEnd: true,
            notes: true,
            images: true,
            job: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            clockIn: "desc",
          },
          take: 50,
        });
        // Add null clockInNotes to all entries
        entries = entries.map((entry: any) => ({
          ...entry,
          clockInNotes: null,
        }));
      } else {
        throw error;
      }
    }

    return { ok: true, entries };
  } catch (error) {
    console.error("Get user time entries error:", error);
    return { ok: false, error: "Failed to fetch time entries" };
  }
}

export async function getCurrentUserRole() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }
  const role = (session.user as any).role;
  return { ok: true, role };
}

export async function updateTimeEntryTimes(entryId: string, clockInIso: string, clockOutIso: string | null, password: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const role = (session.user as any).role;
  const userId = (session.user as any).id;
  if (role !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Admin only" };
  }

  // Verify password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return { ok: false, error: "Password verification failed" };
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Incorrect password" };
  }

  const clockIn = new Date(clockInIso);
  const clockOut = clockOutIso ? new Date(clockOutIso) : null;

  const existing = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: { breakStart: true, breakEnd: true },
  });
  if (!existing) {
    return { ok: false, error: "Time entry not found" };
  }

  let breakMs = 0;
  if (existing.breakStart) {
    const endMs = existing.breakEnd ? existing.breakEnd.getTime() : clockOut ? clockOut.getTime() : Date.now();
    breakMs = endMs - existing.breakStart.getTime();
  }

  const durationHours = clockOut
    ? Math.max((clockOut.getTime() - clockIn.getTime() - Math.max(breakMs, 0)) / (1000 * 60 * 60), 0)
    : null;

  const updated = await prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      clockIn,
      clockOut,
      durationHours,
    },
    include: {
      job: { select: { id: true, title: true } },
    },
  });

  return { ok: true, entry: updated };
}



