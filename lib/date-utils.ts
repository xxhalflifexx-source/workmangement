/**
 * Central Time (America/Chicago) timezone utilities
 * All dates in the system should use Central Time (UTC-06:00)
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import duration from "dayjs/plugin/duration";

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

// Central Time timezone constant
export const CENTRAL_TIMEZONE = "America/Chicago";

/**
 * Get current date/time in Central Time
 */
export function nowInCentral(): dayjs.Dayjs {
  return dayjs().tz(CENTRAL_TIMEZONE);
}

/**
 * Convert a date to Central Time
 * If no date provided, uses current time
 */
export function toCentralTime(date?: Date | string | number | dayjs.Dayjs): dayjs.Dayjs {
  if (!date) {
    return nowInCentral();
  }
  return dayjs(date).tz(CENTRAL_TIMEZONE);
}

/**
 * Convert a date from Central Time to UTC for database storage
 * Database should store in UTC, but we work in Central Time
 */
export function centralToUTC(date: Date | string | number | dayjs.Dayjs): Date {
  return toCentralTime(date).utc().toDate();
}

/**
 * Convert a UTC date from database to Central Time
 */
export function utcToCentral(date: Date | string | number | dayjs.Dayjs): dayjs.Dayjs {
  return dayjs.utc(date).tz(CENTRAL_TIMEZONE);
}

/**
 * Format a date in Central Time with consistent formatting
 * Format: MM/DD/YYYY hh:mm A (CT)
 */
export function formatCentralTime(
  date: Date | string | number | dayjs.Dayjs | null | undefined,
  includeTime: boolean = true
): string {
  if (!date) return "--";
  
  const centralDate = utcToCentral(date);
  
  if (includeTime) {
    return centralDate.format("MM/DD/YYYY hh:mm A [CT]");
  }
  return centralDate.format("MM/DD/YYYY");
}

/**
 * Format a date for date input fields (YYYY-MM-DD) in Central Time
 */
export function formatDateInput(date: Date | string | number | dayjs.Dayjs | null | undefined): string {
  if (!date) return "";
  return utcToCentral(date).format("YYYY-MM-DD");
}

/**
 * Format a date for display (short format) in Central Time
 * Format: MMM DD, YYYY
 */
export function formatDateShort(date: Date | string | number | dayjs.Dayjs | null | undefined): string {
  if (!date) return "--";
  return utcToCentral(date).format("MMM DD, YYYY");
}

/**
 * Format a date with time for display in Central Time
 * Format: MMM DD, YYYY hh:mm A
 */
export function formatDateTime(date: Date | string | number | dayjs.Dayjs | null | undefined): string {
  if (!date) return "--";
  return utcToCentral(date).format("MMM DD, YYYY hh:mm A");
}

/**
 * Format a date with full time for display in Central Time
 * Format: MMM DD, YYYY, hh:mm:ss A
 */
export function formatDateTimeFull(date: Date | string | number | dayjs.Dayjs | null | undefined): string {
  if (!date) return "--";
  return utcToCentral(date).format("MMM DD, YYYY, hh:mm:ss A");
}

/**
 * Parse a date string and convert to Central Time Date object
 * Useful for form inputs
 */
export function parseCentralDate(dateString: string): Date {
  // Parse as if it's in Central Time, then convert to UTC for storage
  return dayjs.tz(dateString, CENTRAL_TIMEZONE).utc().toDate();
}

/**
 * Get start of day in Central Time
 */
export function startOfDayCentral(date?: Date | string | number | dayjs.Dayjs): Date {
  const centralDate = date ? toCentralTime(date) : nowInCentral();
  return centralDate.startOf("day").utc().toDate();
}

/**
 * Get end of day in Central Time
 */
export function endOfDayCentral(date?: Date | string | number | dayjs.Dayjs): Date {
  const centralDate = date ? toCentralTime(date) : nowInCentral();
  return centralDate.endOf("day").utc().toDate();
}

/**
 * Get current date in Central Time as ISO string (for date inputs)
 */
export function todayCentralISO(): string {
  return nowInCentral().format("YYYY-MM-DD");
}

/**
 * Check if a date is today in Central Time
 */
export function isTodayCentral(date: Date | string | number | dayjs.Dayjs): boolean {
  const centralDate = utcToCentral(date);
  const today = nowInCentral();
  return centralDate.isSame(today, "day");
}

