/**
 * Pay Period Utility Functions
 * Handles pay period calculations and earnings computation with overtime support
 */

export interface PayrollSettings {
  payPeriodType: string | null;    // "weekly" or "biweekly"
  payDay: string | null;           // "friday", "thursday", etc.
  payPeriodStartDate: Date | null; // anchor date for bi-weekly
  overtimeEnabled: boolean;
  overtimeType: string | null;     // "weekly40" or "daily8"
  overtimeRate: number | null;     // multiplier like 1.5
}

export interface PayPeriod {
  start: Date;
  end: Date;
  label: string;
}

export interface EarningsBreakdown {
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
}

// Map day names to day numbers (0 = Sunday)
const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Get the day number for a pay day string
 */
function getPayDayNumber(payDay: string | null): number {
  if (!payDay) return 5; // Default to Friday
  return DAY_MAP[payDay.toLowerCase()] ?? 5;
}

/**
 * Get the most recent pay day before or on the given date
 */
function getMostRecentPayDay(date: Date, payDayNum: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  
  const currentDay = result.getDay();
  let daysBack = currentDay - payDayNum;
  if (daysBack < 0) daysBack += 7;
  
  result.setDate(result.getDate() - daysBack);
  return result;
}

/**
 * Get the current pay period based on settings
 */
export function getCurrentPayPeriod(settings: PayrollSettings): PayPeriod {
  return getPayPeriodForDate(new Date(), settings);
}

/**
 * Get the pay period containing a specific date
 */
export function getPayPeriodForDate(date: Date, settings: PayrollSettings): PayPeriod {
  const payDayNum = getPayDayNumber(settings.payDay);
  const periodType = settings.payPeriodType || "weekly";
  
  // Find the most recent pay day (end of period)
  const targetDate = new Date(date);
  targetDate.setHours(23, 59, 59, 999);
  
  let periodEnd = getMostRecentPayDay(targetDate, payDayNum);
  
  // If we're past the pay day this week, move to next week's pay day
  if (periodEnd <= targetDate) {
    // The period ends on this pay day
  } else {
    // Go back one week
    periodEnd.setDate(periodEnd.getDate() - 7);
  }
  
  // Actually, let's recalculate: the period END is the pay day
  // The period START is either 7 or 14 days before that
  
  // Find the next upcoming pay day from the date
  const nextPayDay = new Date(date);
  nextPayDay.setHours(23, 59, 59, 999);
  const currentDay = nextPayDay.getDay();
  let daysUntilPayDay = payDayNum - currentDay;
  if (daysUntilPayDay < 0) daysUntilPayDay += 7;
  nextPayDay.setDate(nextPayDay.getDate() + daysUntilPayDay);
  
  periodEnd = nextPayDay;
  
  let periodStart: Date;
  if (periodType === "biweekly") {
    // For bi-weekly, we need an anchor date to determine which week we're in
    const anchor = settings.payPeriodStartDate 
      ? new Date(settings.payPeriodStartDate) 
      : new Date("2024-01-05"); // Default anchor (a Friday)
    
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceAnchor = Math.floor((periodEnd.getTime() - anchor.getTime()) / msPerWeek);
    const isEvenWeek = weeksSinceAnchor % 2 === 0;
    
    if (!isEvenWeek) {
      // Move end to next week to align with bi-weekly schedule
      periodEnd.setDate(periodEnd.getDate() + 7);
    }
    
    periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 13); // 14 days back, but start is day 1
    periodStart.setHours(0, 0, 0, 0);
  } else {
    // Weekly
    periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 6); // 7 days back
    periodStart.setHours(0, 0, 0, 0);
  }
  
  // Format label
  const startStr = periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const label = `${startStr} - ${endStr}`;
  
  return { start: periodStart, end: periodEnd, label };
}

/**
 * Get the previous pay period
 */
export function getPreviousPayPeriod(settings: PayrollSettings): PayPeriod {
  const current = getCurrentPayPeriod(settings);
  const daysBack = settings.payPeriodType === "biweekly" ? 14 : 7;
  
  const previousDate = new Date(current.start);
  previousDate.setDate(previousDate.getDate() - 1);
  
  return getPayPeriodForDate(previousDate, settings);
}

/**
 * Calculate hours breakdown (regular vs overtime) for daily overtime (8hr/day)
 */
function calculateDailyOvertime(
  entriesByDay: Map<string, number>,
  dailyThreshold: number = 8
): { regular: number; overtime: number } {
  let regular = 0;
  let overtime = 0;
  
  entriesByDay.forEach((hours) => {
    if (hours <= dailyThreshold) {
      regular += hours;
    } else {
      regular += dailyThreshold;
      overtime += hours - dailyThreshold;
    }
  });
  
  return { regular, overtime };
}

/**
 * Calculate earnings with overtime support
 */
export function calculateEarnings(
  totalHours: number,
  hourlyRate: number,
  settings: PayrollSettings,
  entriesByDay?: Map<string, number>
): EarningsBreakdown {
  const rate = hourlyRate || 0;
  const overtimeMultiplier = settings.overtimeRate || 1.5;
  
  let regularHours = totalHours;
  let overtimeHours = 0;
  
  if (settings.overtimeEnabled && settings.overtimeType) {
    if (settings.overtimeType === "daily8" && entriesByDay) {
      // Daily overtime: 1.5x after 8 hours per day
      const breakdown = calculateDailyOvertime(entriesByDay, 8);
      regularHours = breakdown.regular;
      overtimeHours = breakdown.overtime;
    } else if (settings.overtimeType === "weekly40") {
      // Weekly overtime: 1.5x after 40 hours per week
      if (totalHours > 40) {
        regularHours = 40;
        overtimeHours = totalHours - 40;
      }
    }
  }
  
  const regularPay = regularHours * rate;
  const overtimePay = overtimeHours * rate * overtimeMultiplier;
  const totalPay = regularPay + overtimePay;
  
  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    regularPay: Math.round(regularPay * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    totalPay: Math.round(totalPay * 100) / 100,
  };
}

/**
 * Group time entries by day for daily overtime calculation
 */
export function groupEntriesByDay(
  entries: Array<{ clockIn: string | Date; durationHours: number | null }>
): Map<string, number> {
  const byDay = new Map<string, number>();
  
  entries.forEach((entry) => {
    const date = new Date(entry.clockIn);
    const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
    const hours = entry.durationHours || 0;
    
    byDay.set(dayKey, (byDay.get(dayKey) || 0) + hours);
  });
  
  return byDay;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Format hours for display
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

