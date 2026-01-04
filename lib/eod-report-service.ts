/**
 * End-of-Day Report Service
 * 
 * Generates daily report data for employees and jobs.
 * Reuses existing time tracking, payroll, and job costing logic.
 */

import { prisma } from "@/lib/prisma";
import {
  startOfDayCentral,
  endOfDayCentral,
  nowInCentral,
  formatDateShort,
  CENTRAL_TIMEZONE,
} from "@/lib/date-utils";
import {
  getNetWorkSeconds,
  FlagStatus,
  TimeEntryState,
  type TimeEntryWithCap,
} from "@/lib/time-entry-cap";
import {
  calculateEarnings,
  groupEntriesByDay,
  type PayrollSettings,
} from "@/lib/pay-period";

// Configuration constants
export const EOD_REPORT_HOUR = 18; // 6 PM Central
export const MARGIN_ALERT_THRESHOLD = 0.20; // 20% margin alert threshold
export const MAX_NOTES_BULLETS = 3;

// Types
export interface EodEmployeeSummary {
  userId: string;
  name: string;
  email: string | null;
  netWorkHours: number;
  breakHours: number;
  paidHours: number;
  hourlyRate: number;
  laborCost: number;
  workDescription: string[];
  jobsWorked: { jobId: string; title: string; jobNumber: string | null; hours: number }[];
  flags: string[];
}

export interface EodJobSnapshot {
  jobId: string;
  title: string;
  jobNumber: string | null;
  revenue: number | null;
  revenueSource: string | null;
  budget: number | null; // estimatedPrice or finalPrice as budget reference
  hoursToday: number;
  costToday: { labor: number; materials: number; other: number; total: number };
  costToDate: { labor: number; materials: number; other: number; total: number };
  profit: number | null;
  margin: number | null;
  budgetRemaining: number | null;
  budgetUsedPercent: number | null;
  status: string;
  alerts: string[];
}

export interface EodReportData {
  reportDate: string;
  organizationId: string;
  organizationName: string;
  summary: {
    totalLaborHours: number;
    totalLaborCost: number;
    employeeCount: number;
    jobCount: number;
    flagCount: number;
  };
  employees: EodEmployeeSummary[];
  jobs: EodJobSnapshot[];
  exceptions: string[];
}

/**
 * Collect work descriptions from time entries, truncated to max bullets
 */
function collectWorkDescriptions(
  entries: Array<{ clockInNotes?: string | null; notes?: string | null }>,
  maxBullets: number = MAX_NOTES_BULLETS
): string[] {
  const descriptions: string[] = [];
  
  for (const entry of entries) {
    if (entry.clockInNotes?.trim()) {
      descriptions.push(entry.clockInNotes.trim());
    }
    if (entry.notes?.trim() && entry.notes.trim() !== entry.clockInNotes?.trim()) {
      descriptions.push(entry.notes.trim());
    }
    if (descriptions.length >= maxBullets + 1) break;
  }

  if (descriptions.length > maxBullets) {
    const extra = descriptions.length - maxBullets;
    return [...descriptions.slice(0, maxBullets), `+ ${extra} more...`];
  }

  return descriptions;
}

/**
 * Calculate break hours from time entry
 */
function calculateBreakHours(entry: {
  breakStart?: Date | null;
  breakEnd?: Date | null;
  clockOut?: Date | null;
}): number {
  if (!entry.breakStart) return 0;
  
  const breakEnd = entry.breakEnd || entry.clockOut || new Date();
  const breakMs = breakEnd.getTime() - entry.breakStart.getTime();
  return Math.max(breakMs / (1000 * 60 * 60), 0);
}

/**
 * Get net work hours for an entry - handles both old entries and new soft-cap entries
 */
function getEntryNetWorkHours(entry: {
  clockIn: Date;
  clockOut: Date | null;
  breakStart?: Date | null;
  breakEnd?: Date | null;
  state?: string;
  workAccumSeconds?: number;
  lastStateChangeAt?: Date | null;
  capMinutes?: number;
  flagStatus?: string;
  overCapAt?: Date | null;
  durationHours?: number | null;
}, now: Date): number {
  // If we have durationHours already calculated (legacy field), use it
  if (entry.durationHours && entry.durationHours > 0) {
    return entry.durationHours;
  }
  
  // If workAccumSeconds is populated (soft-cap enabled entry), use it
  if (entry.workAccumSeconds && entry.workAccumSeconds > 0) {
    if (entry.state === TimeEntryState.CLOCKED_OUT || entry.clockOut) {
      return entry.workAccumSeconds / 3600;
    }
    // For open entries with soft-cap, calculate current net work
    const capEntry: TimeEntryWithCap = {
      id: '',
      clockIn: entry.clockIn,
      clockOut: entry.clockOut,
      state: (entry.state || TimeEntryState.WORKING) as any,
      workAccumSeconds: entry.workAccumSeconds,
      lastStateChangeAt: entry.lastStateChangeAt || entry.clockIn,
      capMinutes: entry.capMinutes || 960,
      flagStatus: (entry.flagStatus || FlagStatus.NONE) as any,
      overCapAt: entry.overCapAt || null,
    };
    return getNetWorkSeconds(capEntry, now) / 3600;
  }
  
  // Fallback: Calculate from clockIn/clockOut minus break time (legacy entries)
  const endTime = entry.clockOut || now;
  const totalMs = endTime.getTime() - entry.clockIn.getTime();
  
  // Subtract break time
  let breakMs = 0;
  if (entry.breakStart) {
    const breakEnd = entry.breakEnd || entry.clockOut || now;
    breakMs = Math.max(breakEnd.getTime() - entry.breakStart.getTime(), 0);
  }
  
  const netMs = Math.max(totalMs - breakMs, 0);
  return netMs / (1000 * 60 * 60);
}

/**
 * Generate employee summaries for the day
 */
async function generateEmployeeSummaries(
  organizationId: string,
  dayStart: Date,
  dayEnd: Date,
  now: Date,
  paySettings: PayrollSettings
): Promise<{ employees: EodEmployeeSummary[]; exceptions: string[]; totalFlags: number }> {
  const employees: EodEmployeeSummary[] = [];
  const exceptions: string[] = [];
  let totalFlags = 0;

  // Get all time entries for the day with user info
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      organizationId,
      clockIn: { gte: dayStart, lte: dayEnd },
    },
    include: {
      user: { select: { id: true, name: true, email: true, hourlyRate: true } },
      job: { select: { id: true, title: true, jobNumber: true } },
    },
    orderBy: { clockIn: 'asc' },
  });

  // Group entries by user
  const entriesByUser = new Map<string, typeof timeEntries>();
  for (const entry of timeEntries) {
    const existing = entriesByUser.get(entry.userId) || [];
    existing.push(entry);
    entriesByUser.set(entry.userId, existing);
  }

  // Process each user
  for (const [userId, userEntries] of Array.from(entriesByUser.entries())) {
    const user = userEntries[0].user;
    const flags: string[] = [];
    
    let totalNetWorkHours = 0;
    let totalBreakHours = 0;
    const jobsMap = new Map<string, { title: string; jobNumber: string | null; hours: number }>();

    for (const entry of userEntries) {
      // Check for open entries
      if (!entry.clockOut) {
        flags.push('open_entry');
        exceptions.push(`${user.name || user.email || 'Unknown'}: Open time entry (not clocked out)`);
      }

      // Check for over-cap
      if ((entry as any).flagStatus === FlagStatus.OVER_CAP) {
        flags.push('over_cap');
        exceptions.push(`${user.name || user.email || 'Unknown'}: Over 16-hour cap flagged`);
      }

      // Check for missing notes
      if (!entry.clockInNotes && !entry.notes) {
        flags.push('missing_notes');
      }

      // Calculate hours
      const netWorkHours = getEntryNetWorkHours(entry as any, now);
      totalNetWorkHours += netWorkHours;
      totalBreakHours += calculateBreakHours(entry);

      // Track job hours
      if (entry.job) {
        const jobData = jobsMap.get(entry.jobId!) || { 
          title: entry.job.title, 
          jobNumber: entry.job.jobNumber,
          hours: 0 
        };
        jobData.hours += netWorkHours;
        jobsMap.set(entry.jobId!, jobData);
      }
    }

    // Calculate earnings using existing payroll logic
    const entriesByDay = groupEntriesByDay(
      userEntries.map((e: typeof userEntries[0]) => ({ clockIn: e.clockIn, durationHours: getEntryNetWorkHours(e as any, now) }))
    );
    const hourlyRate = user.hourlyRate || 0;
    const earnings = calculateEarnings(totalNetWorkHours, hourlyRate, paySettings, entriesByDay);

    // Dedupe flags
    const uniqueFlags = Array.from(new Set(flags));
    totalFlags += uniqueFlags.length;

    employees.push({
      userId,
      name: user.name || 'Unknown',
      email: user.email,
      netWorkHours: Math.round(totalNetWorkHours * 100) / 100,
      breakHours: Math.round(totalBreakHours * 100) / 100,
      paidHours: earnings.regularHours + earnings.overtimeHours,
      hourlyRate,
      laborCost: earnings.totalPay,
      workDescription: collectWorkDescriptions(userEntries),
      jobsWorked: Array.from(jobsMap.entries()).map(([jobId, data]) => ({
        jobId,
        title: data.title,
        jobNumber: data.jobNumber,
        hours: Math.round(data.hours * 100) / 100,
      })),
      flags: uniqueFlags,
    });
  }

  return { employees, exceptions, totalFlags };
}

/**
 * Generate job snapshots for jobs worked today
 */
async function generateJobSnapshots(
  organizationId: string,
  dayStart: Date,
  dayEnd: Date,
  now: Date
): Promise<{ jobs: EodJobSnapshot[]; exceptions: string[] }> {
  const jobs: EodJobSnapshot[] = [];
  const exceptions: string[] = [];

  // Get jobs that had time entries today
  const todayEntries = await prisma.timeEntry.findMany({
    where: {
      organizationId,
      clockIn: { gte: dayStart, lte: dayEnd },
      jobId: { not: null },
    },
    select: { jobId: true },
    distinct: ['jobId'],
  });

  const jobIds = todayEntries.map(e => e.jobId).filter(Boolean) as string[];
  if (jobIds.length === 0) {
    return { jobs, exceptions };
  }

  // Get full job data
  const jobRecords = await prisma.job.findMany({
    where: { id: { in: jobIds } },
    include: {
      expenses: true,
      timeEntries: {
        include: { user: { select: { hourlyRate: true } } },
      },
    },
  });

  for (const job of jobRecords) {
    const alerts: string[] = [];

    // Determine revenue
    let revenue: number | null = null;
    let revenueSource: string | null = null;
    
    if (job.finalPrice) {
      revenue = job.finalPrice;
      revenueSource = 'Final Price';
    } else if (job.estimatedPrice) {
      revenue = job.estimatedPrice;
      revenueSource = 'Estimated Price';
    } else {
      alerts.push('missing_revenue');
      exceptions.push(`Job "${job.title}": Missing revenue/pricing`);
    }

    // Calculate costs today
    const todayTimeEntries = job.timeEntries.filter(
      e => e.clockIn >= dayStart && e.clockIn <= dayEnd
    );
    const todayExpenses = job.expenses.filter(
      e => e.expenseDate >= dayStart && e.expenseDate <= dayEnd
    );

    let laborCostToday = 0;
    let hoursToday = 0;
    for (const entry of todayTimeEntries) {
      const hours = getEntryNetWorkHours(entry as any, now);
      const rate = entry.user.hourlyRate || 0;
      hoursToday += hours;
      laborCostToday += hours * rate;
    }

    let materialsCostToday = 0;
    let otherCostToday = 0;
    for (const expense of todayExpenses) {
      if (expense.category === 'Materials') {
        materialsCostToday += expense.amount;
      } else {
        otherCostToday += expense.amount;
      }
    }

    // Calculate costs to date (all time)
    let laborCostToDate = 0;
    let totalHoursToDate = 0;
    for (const entry of job.timeEntries) {
      const hours = getEntryNetWorkHours(entry as any, now);
      const rate = entry.user.hourlyRate || 0;
      totalHoursToDate += hours;
      laborCostToDate += hours * rate;
    }

    let materialsCostToDate = 0;
    let otherCostToDate = 0;
    for (const expense of job.expenses) {
      if (expense.category === 'Materials') {
        materialsCostToDate += expense.amount;
      } else {
        otherCostToDate += expense.amount;
      }
    }

    const totalCostToday = laborCostToday + materialsCostToday + otherCostToday;
    const totalCostToDate = laborCostToDate + materialsCostToDate + otherCostToDate;

    // Budget is the revenue (finalPrice or estimatedPrice)
    const budget = revenue;

    // Calculate budget remaining and percentage used
    let budgetRemaining: number | null = null;
    let budgetUsedPercent: number | null = null;
    
    if (budget !== null && budget > 0) {
      budgetRemaining = budget - totalCostToDate;
      budgetUsedPercent = totalCostToDate / budget;
      
      // Alert if over 80% of budget used
      if (budgetUsedPercent > 0.8 && budgetUsedPercent < 1) {
        alerts.push('near_budget');
      }
    }

    // Calculate profit and margin
    let profit: number | null = null;
    let margin: number | null = null;
    
    if (revenue !== null) {
      profit = revenue - totalCostToDate;
      margin = revenue > 0 ? profit / revenue : 0;

      // Check margin threshold
      if (margin < MARGIN_ALERT_THRESHOLD) {
        alerts.push('low_margin');
        exceptions.push(`Job "${job.title}": Margin below ${MARGIN_ALERT_THRESHOLD * 100}% (${(margin * 100).toFixed(1)}%)`);
      }

      // Check if over budget (negative profit)
      if (profit < 0) {
        alerts.push('over_budget');
        exceptions.push(`Job "${job.title}": Over budget by $${Math.abs(profit).toFixed(2)}`);
      }
    }

    jobs.push({
      jobId: job.id,
      title: job.title,
      jobNumber: job.jobNumber,
      revenue,
      revenueSource,
      budget,
      hoursToday: Math.round(hoursToday * 100) / 100,
      costToday: {
        labor: Math.round(laborCostToday * 100) / 100,
        materials: Math.round(materialsCostToday * 100) / 100,
        other: Math.round(otherCostToday * 100) / 100,
        total: Math.round(totalCostToday * 100) / 100,
      },
      costToDate: {
        labor: Math.round(laborCostToDate * 100) / 100,
        materials: Math.round(materialsCostToDate * 100) / 100,
        other: Math.round(otherCostToDate * 100) / 100,
        total: Math.round(totalCostToDate * 100) / 100,
      },
      profit: profit !== null ? Math.round(profit * 100) / 100 : null,
      margin: margin !== null ? Math.round(margin * 1000) / 1000 : null,
      budgetRemaining: budgetRemaining !== null ? Math.round(budgetRemaining * 100) / 100 : null,
      budgetUsedPercent: budgetUsedPercent !== null ? Math.round(budgetUsedPercent * 1000) / 1000 : null,
      status: job.status,
      alerts,
    });
  }

  return { jobs, exceptions };
}

/**
 * Get payroll settings for the organization
 */
async function getPayrollSettings(organizationId: string): Promise<PayrollSettings> {
  const settings = await prisma.companySettings.findFirst({
    where: { organizationId },
  });

  return {
    payPeriodType: settings?.payPeriodType || 'weekly',
    payDay: settings?.payDay || 'friday',
    payPeriodStartDate: settings?.payPeriodStartDate || null,
    overtimeEnabled: settings?.overtimeEnabled || false,
    overtimeType: settings?.overtimeType || 'weekly40',
    overtimeRate: settings?.overtimeRate || 1.5,
  };
}

/**
 * Generate the complete EOD report for an organization
 */
export async function generateEodReport(
  organizationId: string,
  reportDate?: Date
): Promise<EodReportData> {
  const now = reportDate ? new Date(reportDate) : nowInCentral().toDate();
  const dayStart = startOfDayCentral(now);
  const dayEnd = endOfDayCentral(now);

  // Get organization info
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  if (!org) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  // Get payroll settings
  const paySettings = await getPayrollSettings(organizationId);

  // Generate employee summaries
  const { employees, exceptions: empExceptions, totalFlags } = await generateEmployeeSummaries(
    organizationId,
    dayStart,
    dayEnd,
    now,
    paySettings
  );

  // Generate job snapshots
  const { jobs, exceptions: jobExceptions } = await generateJobSnapshots(
    organizationId,
    dayStart,
    dayEnd,
    now
  );

  // Combine exceptions
  const exceptions = [...empExceptions, ...jobExceptions];

  // Calculate summary totals
  const totalLaborHours = employees.reduce((sum, e) => sum + e.netWorkHours, 0);
  const totalLaborCost = employees.reduce((sum, e) => sum + e.laborCost, 0);

  return {
    reportDate: formatDateShort(now),
    organizationId,
    organizationName: org.name,
    summary: {
      totalLaborHours: Math.round(totalLaborHours * 100) / 100,
      totalLaborCost: Math.round(totalLaborCost * 100) / 100,
      employeeCount: employees.length,
      jobCount: jobs.length,
      flagCount: totalFlags + jobs.filter(j => j.alerts.length > 0).length,
    },
    employees,
    jobs,
    exceptions,
  };
}

/**
 * Get admin recipients for EOD report
 */
export async function getEodReportRecipients(organizationId: string): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      organizationId,
      role: { in: ['ADMIN', 'MANAGER'] },
      status: 'APPROVED',
      email: { not: null },
    },
    select: { email: true },
  });

  return admins.map(a => a.email!).filter(Boolean);
}

/**
 * Generate a text preview of the report (for console/dry-run)
 */
export function formatReportPreview(report: EodReportData): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(60));
  lines.push(`EOD Report: ${report.organizationName}`);
  lines.push(`Date: ${report.reportDate}`);
  lines.push('='.repeat(60));
  
  lines.push('\n--- SUMMARY ---');
  lines.push(`Total Labor Hours: ${report.summary.totalLaborHours.toFixed(2)}`);
  lines.push(`Total Labor Cost: $${report.summary.totalLaborCost.toFixed(2)}`);
  lines.push(`Employees Active: ${report.summary.employeeCount}`);
  lines.push(`Jobs Touched: ${report.summary.jobCount}`);
  lines.push(`Flags/Alerts: ${report.summary.flagCount}`);
  
  lines.push('\n--- EMPLOYEES ---');
  for (const emp of report.employees) {
    lines.push(`\n${emp.name} (${emp.email || 'no email'})`);
    lines.push(`  Hours: ${emp.netWorkHours.toFixed(2)} work, ${emp.breakHours.toFixed(2)} break`);
    lines.push(`  Pay: $${emp.laborCost.toFixed(2)} @ $${emp.hourlyRate}/hr`);
    if (emp.jobsWorked.length > 0) {
      lines.push(`  Jobs: ${emp.jobsWorked.map(j => `${j.title} (${j.hours.toFixed(1)}h)`).join(', ')}`);
    }
    if (emp.flags.length > 0) {
      lines.push(`  Flags: ${emp.flags.join(', ')}`);
    }
  }
  
  lines.push('\n--- JOB PROFIT SNAPSHOTS ---');
  for (const job of report.jobs) {
    lines.push(`\n${job.jobNumber || 'No #'}: ${job.title}`);
    lines.push(`  Revenue: ${job.revenue !== null ? '$' + job.revenue.toFixed(2) : 'N/A'} (${job.revenueSource || 'none'})`);
    lines.push(`  Cost Today: $${job.costToday.total.toFixed(2)} (L:$${job.costToday.labor.toFixed(2)}, M:$${job.costToday.materials.toFixed(2)})`);
    lines.push(`  Cost To Date: $${job.costToDate.total.toFixed(2)}`);
    lines.push(`  Profit: ${job.profit !== null ? '$' + job.profit.toFixed(2) : 'N/A'}, Margin: ${job.margin !== null ? (job.margin * 100).toFixed(1) + '%' : 'N/A'}`);
    if (job.alerts.length > 0) {
      lines.push(`  Alerts: ${job.alerts.join(', ')}`);
    }
  }
  
  if (report.exceptions.length > 0) {
    lines.push('\n--- EXCEPTIONS ---');
    for (const exc of report.exceptions) {
      lines.push(`  - ${exc}`);
    }
  }
  
  lines.push('\n' + '='.repeat(60));
  
  return lines.join('\n');
}

