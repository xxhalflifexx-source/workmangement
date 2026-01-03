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

    const paySettings: PayrollSettings = {
      payPeriodType: companySettings?.payPeriodType || "weekly",
      payDay: companySettings?.payDay || "friday",
      payPeriodStartDate: companySettings?.payPeriodStartDate || null,
      overtimeEnabled: companySettings?.overtimeEnabled || false,
      overtimeType: companySettings?.overtimeType || "weekly40",
      overtimeRate: companySettings?.overtimeRate || 1.5,
    };

    const currentPeriod = getCurrentPayPeriod(paySettings);

    // Get all employees in the organization
    const employees = await prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        status: "APPROVED",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hourlyRate: true,
        lastPaidDate: true,
      },
      orderBy: { name: "asc" },
    });

    // Get time entries for current period for all employees
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        organizationId: user.organizationId,
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
        const empEntries = entriesByUser.get(emp.id) || [];
        
        // Calculate hours for current period
        let totalHours = 0;
        const jobsWorked = new Set<string>();
        
        empEntries.forEach((entry) => {
          totalHours += entry.durationHours || 0;
          if (entry.job?.title) {
            jobsWorked.add(entry.job.title);
          }
        });

        // Calculate earnings
        const entriesByDay = groupEntriesByDay(
          empEntries.map((e) => ({ clockIn: e.clockIn, durationHours: e.durationHours }))
        );
        const earnings = emp.hourlyRate
          ? calculateEarnings(totalHours, emp.hourlyRate, paySettings, entriesByDay)
          : { regularHours: totalHours, overtimeHours: 0, regularPay: 0, overtimePay: 0, totalPay: 0 };

        // Calculate unpaid since last payment (if applicable)
        let unpaidSince = null;
        if (emp.lastPaidDate) {
          const unpaidEntries = await prisma.timeEntry.findMany({
            where: {
              userId: emp.id,
              clockIn: { gt: emp.lastPaidDate },
              clockOut: { not: null },
            },
          });

          if (unpaidEntries.length > 0) {
            let unpaidHours = 0;
            unpaidEntries.forEach((entry) => {
              unpaidHours += entry.durationHours || 0;
            });

            const unpaidEarnings = emp.hourlyRate
              ? calculateEarnings(unpaidHours, emp.hourlyRate, paySettings)
              : { totalPay: 0 };

            unpaidSince = {
              start: emp.lastPaidDate.toISOString(),
              totalHours: Math.round(unpaidHours * 100) / 100,
              totalPay: unpaidEarnings.totalPay,
              entriesCount: unpaidEntries.length,
            };
          }
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
            entriesCount: empEntries.length,
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
    
    await prisma.user.update({
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
    const result = await prisma.user.updateMany({
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

