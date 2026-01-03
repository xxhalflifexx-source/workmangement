"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { 
  PayrollSettings, 
  getCurrentPayPeriod, 
  calculateEarnings, 
  groupEntriesByDay,
  formatCurrency 
} from "@/lib/pay-period";

export interface EmployeePayrollSummary {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  hourlyRate: number | null;
  lastPaidDate: string | null;
  currentPeriod: {
    start: string;
    end: string;
    totalHours: number;
    regularHours: number;
    overtimeHours: number;
    regularPay: number;
    overtimePay: number;
    totalPay: number;
    entriesCount: number;
    jobsWorked: string[];
  };
  unpaidSince: {
    start: string;
    totalHours: number;
    totalPay: number;
    entriesCount: number;
  } | null;
}

/**
 * Get payroll summary for all employees in the organization
 */
export async function getPayrollSummary() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userId = (session.user as any).id;
    const role = (session.user as any).role;

    // Only admins and managers can view payroll
    if (role !== "ADMIN" && role !== "MANAGER") {
      return { ok: false, error: "Not authorized to view payroll" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return { ok: false, error: "User not associated with an organization" };
    }

    // Get company settings for payroll config
    const companySettings = await prisma.companySettings.findFirst({
      where: { organizationId: user.organizationId },
    });

    const cs = companySettings as any;
    const paySettings: PayrollSettings = {
      payPeriodType: cs?.payPeriodType || "weekly",
      payDay: cs?.payDay || "friday",
      payPeriodStartDate: cs?.payPeriodStartDate || null,
      overtimeEnabled: cs?.overtimeEnabled || false,
      overtimeType: cs?.overtimeType || "weekly40",
      overtimeRate: cs?.overtimeRate || 1.5,
    };

    const currentPeriod = getCurrentPayPeriod(paySettings);
    
    console.log("[Payroll] Current period:", {
      start: currentPeriod.start.toISOString(),
      end: currentPeriod.end.toISOString(),
      label: currentPeriod.label,
      paySettings,
    });

    // Get all employees in the organization
    const employees = await prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        status: "APPROVED",
      },
      orderBy: { name: "asc" },
    }) as unknown as Array<{
      id: string;
      name: string | null;
      email: string | null;
      role: string;
      hourlyRate: number | null;
      lastPaidDate: Date | null;
    }>;

    // Get employee IDs for this organization
    const employeeIds = employees.map(e => e.id);

    // Get time entries for current period for all employees
    // Query by userId (belonging to org) since some old entries may not have organizationId set
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        userId: { in: employeeIds },
        clockIn: {
          gte: currentPeriod.start,
          lte: currentPeriod.end,
        },
        clockOut: { not: null }, // Only count completed entries
      },
      include: {
        job: { select: { title: true } },
      },
    });

    console.log("[Payroll] Found time entries:", timeEntries.length);
    console.log("[Payroll] Employee IDs in org:", employeeIds.length);
    console.log("[Payroll] Period:", currentPeriod.start.toISOString(), "to", currentPeriod.end.toISOString());
    
    // Debug: Check recent time entries for these users
    const recentEntries = await prisma.timeEntry.findMany({
      where: { userId: { in: employeeIds } },
      take: 10,
      orderBy: { clockIn: 'desc' },
    });
    console.log("[Payroll] Recent time entries (all dates):", recentEntries.map(e => ({
      id: e.id.slice(0, 8),
      userId: e.userId.slice(0, 8),
      clockIn: e.clockIn.toISOString(),
      clockOut: e.clockOut?.toISOString() || 'ACTIVE',
      durationHours: e.durationHours,
    })));

    // Group entries by user
    const entriesByUser = new Map<string, typeof timeEntries>();
    timeEntries.forEach((entry) => {
      const existing = entriesByUser.get(entry.userId) || [];
      existing.push(entry);
      entriesByUser.set(entry.userId, existing);
    });

    // Calculate summary for each employee
    const summaries: EmployeePayrollSummary[] = await Promise.all(
      employees.map(async (emp) => {
        // Determine the start date for "owed" calculation
        // If lastPaidDate exists, use that; otherwise use period start
        const owedSinceDate = emp.lastPaidDate 
          ? (emp.lastPaidDate > currentPeriod.start ? emp.lastPaidDate : currentPeriod.start)
          : currentPeriod.start;
        
        // Get entries since last payment (what's owed)
        const owedEntries = await prisma.timeEntry.findMany({
          where: {
            userId: emp.id,
            clockIn: { gt: owedSinceDate },
            clockOut: { not: null },
          },
          include: {
            job: { select: { title: true } },
          },
        });
        
        // Calculate hours owed (since last payment)
        let totalHours = 0;
        const jobsWorked = new Set<string>();
        
        owedEntries.forEach((entry) => {
          totalHours += entry.durationHours || 0;
          if (entry.job?.title) {
            jobsWorked.add(entry.job.title);
          }
        });

        // Calculate earnings
        const entriesByDay = groupEntriesByDay(
          owedEntries.map((e) => ({ clockIn: e.clockIn, durationHours: e.durationHours }))
        );
        const earnings = emp.hourlyRate
          ? calculateEarnings(totalHours, emp.hourlyRate, paySettings, entriesByDay)
          : { regularHours: totalHours, overtimeHours: 0, regularPay: 0, overtimePay: 0, totalPay: 0 };

        // Calculate unpaid since last payment info
        let unpaidSince = null;
        if (emp.lastPaidDate) {
          unpaidSince = {
            start: emp.lastPaidDate.toISOString(),
            totalHours: Math.round(totalHours * 100) / 100,
            totalPay: earnings.totalPay,
            entriesCount: owedEntries.length,
          };
        }

        return {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          role: emp.role,
          hourlyRate: emp.hourlyRate,
          lastPaidDate: emp.lastPaidDate?.toISOString() || null,
          currentPeriod: {
            start: currentPeriod.start.toISOString(),
            end: currentPeriod.end.toISOString(),
            totalHours: Math.round(totalHours * 100) / 100,
            regularHours: earnings.regularHours,
            overtimeHours: earnings.overtimeHours,
            regularPay: earnings.regularPay,
            overtimePay: earnings.overtimePay,
            totalPay: earnings.totalPay,
            entriesCount: owedEntries.length,
            jobsWorked: Array.from(jobsWorked),
          },
          unpaidSince,
        };
      })
    );

    return {
      ok: true,
      summaries,
      currentPeriod: {
        start: currentPeriod.start.toISOString(),
        end: currentPeriod.end.toISOString(),
        label: currentPeriod.label,
      },
      paySettings: {
        payPeriodType: paySettings.payPeriodType,
        overtimeEnabled: paySettings.overtimeEnabled,
        overtimeRate: paySettings.overtimeRate,
      },
    };
  } catch (error) {
    console.error("[getPayrollSummary] Error:", error);
    return { ok: false, error: "Failed to load payroll summary" };
  }
}

/**
 * Mark an employee as paid (updates lastPaidDate)
 */
export async function markEmployeeAsPaid(employeeId: string, paidDate?: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const role = (session.user as any).role;
    if (role !== "ADMIN" && role !== "MANAGER") {
      return { ok: false, error: "Not authorized to mark payments" };
    }

    const adminUserId = (session.user as any).id;
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { organizationId: true },
    });

    // Verify employee is in same organization
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, organizationId: true },
    });

    if (!employee || employee.organizationId !== admin?.organizationId) {
      return { ok: false, error: "Employee not found in your organization" };
    }

    // Update the lastPaidDate
    const payDate = paidDate ? new Date(paidDate) : new Date();
    
    await (prisma.user.update as any)({
      where: { id: employeeId },
      data: { lastPaidDate: payDate },
    });

    return {
      ok: true,
      message: `Marked ${employee.name || "employee"} as paid through ${payDate.toLocaleDateString()}`,
    };
  } catch (error) {
    console.error("[markEmployeeAsPaid] Error:", error);
    return { ok: false, error: "Failed to mark employee as paid" };
  }
}

/**
 * Mark multiple employees as paid
 */
export async function markAllAsPaid(employeeIds: string[], paidDate?: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const role = (session.user as any).role;
    if (role !== "ADMIN" && role !== "MANAGER") {
      return { ok: false, error: "Not authorized to mark payments" };
    }

    const adminUserId = (session.user as any).id;
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { organizationId: true },
    });

    const payDate = paidDate ? new Date(paidDate) : new Date();

    // Update all employees in the organization
    const result = await (prisma.user.updateMany as any)({
      where: {
        id: { in: employeeIds },
        organizationId: admin?.organizationId,
      },
      data: { lastPaidDate: payDate },
    });

    return {
      ok: true,
      message: `Marked ${result.count} employees as paid through ${payDate.toLocaleDateString()}`,
      count: result.count,
    };
  } catch (error) {
    console.error("[markAllAsPaid] Error:", error);
    return { ok: false, error: "Failed to mark employees as paid" };
  }
}

/**
 * Get detailed time entries for an employee in a date range
 */
export async function getEmployeeTimeDetails(employeeId: string, startDate: string, endDate: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const role = (session.user as any).role;
    const requesterId = (session.user as any).id;

    // Employees can only view their own, admins/managers can view all in org
    if (role !== "ADMIN" && role !== "MANAGER" && requesterId !== employeeId) {
      return { ok: false, error: "Not authorized to view this employee's time" };
    }

    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: employeeId,
        clockIn: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        job: { select: { id: true, title: true, jobNumber: true } },
      },
      orderBy: { clockIn: "desc" },
    });

    const serialized = entries.map((entry) => ({
      id: entry.id,
      clockIn: entry.clockIn.toISOString(),
      clockOut: entry.clockOut?.toISOString() || null,
      durationHours: entry.durationHours,
      notes: entry.notes,
      job: entry.job
        ? { id: entry.job.id, title: entry.job.title, jobNumber: entry.job.jobNumber }
        : null,
    }));

    return { ok: true, entries: serialized };
  } catch (error) {
    console.error("[getEmployeeTimeDetails] Error:", error);
    return { ok: false, error: "Failed to load time details" };
  }
}

