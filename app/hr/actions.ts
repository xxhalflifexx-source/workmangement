"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function getAllUsersStats() {
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
    const users = await prisma.user.findMany({
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

    // Calculate stats for each user
    const usersWithStats = users.map((user) => {
      let totalHours = 0;
      let completedShifts = 0;
      let thisWeekHours = 0;
      let thisMonthHours = 0;

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      user.timeEntries.forEach((entry) => {
        if (entry.clockIn && entry.clockOut) {
          const duration = new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime();
          const hours = duration / (1000 * 60 * 60);
          
          totalHours += hours;
          completedShifts++;

          const clockInDate = new Date(entry.clockIn);
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
        totalHours: Math.round(totalHours * 10) / 10,
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
    const entries = await prisma.timeEntry.findMany({
      where: { userId },
      include: {
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

    return { ok: true, entries };
  } catch (error) {
    console.error("Get user time entries error:", error);
    return { ok: false, error: "Failed to fetch time entries" };
  }
}



