/**
 * Soft Cap Logic for Time Entries
 * 
 * Implements the 16-hour net work time cap (breaks excluded).
 * These are pure functions that can be tested independently.
 */

// Constants
export const DEFAULT_CAP_MINUTES = 960; // 16 hours
export const CAP_REMINDER_OFFSET_MINUTES = 30; // Reminder 30 minutes before cap

// Enums (matching Prisma schema)
export const TimeEntryState = {
  WORKING: 'WORKING',
  ON_BREAK: 'ON_BREAK',
  CLOCKED_OUT: 'CLOCKED_OUT',
} as const;

export type TimeEntryStateType = typeof TimeEntryState[keyof typeof TimeEntryState];

export const FlagStatus = {
  NONE: 'NONE',
  OVER_CAP: 'OVER_CAP',
  EDIT_REQUEST_PENDING: 'EDIT_REQUEST_PENDING',
  RESOLVED: 'RESOLVED',
  FORGOT_CLOCK_OUT: 'FORGOT_CLOCK_OUT', // Employee used "Forgot to clock out" correction
} as const;

export type FlagStatusType = typeof FlagStatus[keyof typeof FlagStatus];

// Type for time entry with soft cap fields
export interface TimeEntryWithCap {
  id: string;
  clockIn: Date;
  clockOut: Date | null;
  state: TimeEntryStateType;
  workAccumSeconds: number;
  lastStateChangeAt: Date | null;
  capMinutes: number;
  flagStatus: FlagStatusType;
  overCapAt: Date | null;
}

// Mutable version for internal operations
export interface MutableTimeEntry extends TimeEntryWithCap {
  state: TimeEntryStateType;
  workAccumSeconds: number;
  lastStateChangeAt: Date | null;
  flagStatus: FlagStatusType;
  overCapAt: Date | null;
}

/**
 * Settle accumulated work time up to the current moment.
 * Only adds time if entry is in WORKING state.
 * Updates lastStateChangeAt to now.
 * 
 * @param entry The time entry to settle
 * @param now Current timestamp
 * @returns Updated entry (mutates and returns same object for convenience)
 */
export function settleWork<T extends MutableTimeEntry>(entry: T, now: Date): T {
  if (entry.state === TimeEntryState.WORKING && entry.lastStateChangeAt) {
    const deltaMs = now.getTime() - entry.lastStateChangeAt.getTime();
    const deltaSeconds = Math.max(Math.floor(deltaMs / 1000), 0);
    entry.workAccumSeconds += deltaSeconds;
  }
  entry.lastStateChangeAt = now;
  return entry;
}

/**
 * Get the current net work time in seconds.
 * If WORKING, includes elapsed time since lastStateChangeAt.
 * If ON_BREAK or CLOCKED_OUT, just returns accumulated time.
 * 
 * @param entry The time entry
 * @param now Current timestamp
 * @returns Net work time in seconds
 */
export function getNetWorkSeconds(entry: TimeEntryWithCap, now: Date): number {
  if (entry.state === TimeEntryState.WORKING && entry.lastStateChangeAt) {
    const elapsedMs = now.getTime() - entry.lastStateChangeAt.getTime();
    const elapsedSeconds = Math.max(Math.floor(elapsedMs / 1000), 0);
    return entry.workAccumSeconds + elapsedSeconds;
  }
  return entry.workAccumSeconds;
}

/**
 * Get net work time in hours (for display/calculations)
 */
export function getNetWorkHours(entry: TimeEntryWithCap, now: Date): number {
  return getNetWorkSeconds(entry, now) / 3600;
}

/**
 * Get the cap in seconds
 */
export function getCapSeconds(entry: TimeEntryWithCap): number {
  return entry.capMinutes * 60;
}

/**
 * Compute the exact timestamp when the entry will/did reach the cap.
 * Only meaningful when state is WORKING and not already over cap.
 * 
 * @param entry The time entry
 * @returns The timestamp when cap is/was reached, or null if not applicable
 */
export function computeOverCapAt(entry: TimeEntryWithCap): Date | null {
  if (entry.state !== TimeEntryState.WORKING || !entry.lastStateChangeAt) {
    return entry.overCapAt; // Return existing value if not actively working
  }
  
  const capSeconds = getCapSeconds(entry);
  const remaining = capSeconds - entry.workAccumSeconds;
  
  if (remaining <= 0) {
    // Already past cap when we started this work segment
    return entry.lastStateChangeAt;
  }
  
  // Cap will be reached at lastStateChangeAt + remaining seconds
  return new Date(entry.lastStateChangeAt.getTime() + remaining * 1000);
}

/**
 * Apply the soft cap flag if net work time >= cap.
 * Does NOT auto-clock-out the entry.
 * 
 * @param entry The time entry to check/flag
 * @param now Current timestamp
 * @returns Updated entry with flag applied if over cap
 */
export function applySoftCapFlag<T extends MutableTimeEntry>(entry: T, now: Date): T {
  const netWorkSeconds = getNetWorkSeconds(entry, now);
  const capSeconds = getCapSeconds(entry);
  
  if (netWorkSeconds >= capSeconds && entry.flagStatus !== FlagStatus.OVER_CAP) {
    entry.flagStatus = FlagStatus.OVER_CAP;
    
    // Compute the exact moment when the cap was crossed
    if (!entry.overCapAt) {
      if (entry.state === TimeEntryState.WORKING && entry.lastStateChangeAt) {
        // Calculate the exact crossing time
        const excessSeconds = netWorkSeconds - capSeconds;
        entry.overCapAt = new Date(now.getTime() - excessSeconds * 1000);
      } else {
        // If not working, the cap was reached before this state
        entry.overCapAt = computeOverCapAt(entry) ?? now;
      }
    }
  }
  
  return entry;
}

/**
 * Get effective net work seconds for payroll/costing.
 * If flagged OVER_CAP, caps the value at the cap limit.
 * This prevents runaway costs for forgotten clock-outs.
 * 
 * @param entry The time entry
 * @param now Current timestamp
 * @returns Effective net work seconds (capped if over limit)
 */
export function getEffectiveNetWorkSeconds(entry: TimeEntryWithCap, now: Date): number {
  const netWorkSeconds = getNetWorkSeconds(entry, now);
  const capSeconds = getCapSeconds(entry);
  
  if (entry.flagStatus === FlagStatus.OVER_CAP) {
    return Math.min(netWorkSeconds, capSeconds);
  }
  
  return netWorkSeconds;
}

/**
 * Get effective net work hours for payroll/costing.
 */
export function getEffectiveNetWorkHours(entry: TimeEntryWithCap, now: Date): number {
  return getEffectiveNetWorkSeconds(entry, now) / 3600;
}

/**
 * Check if entry is approaching the cap (within reminder threshold).
 * 
 * @param entry The time entry
 * @param now Current timestamp
 * @param reminderMinutes Minutes before cap to trigger reminder (default: 30)
 * @returns True if within reminder threshold but not yet over cap
 */
export function isApproachingCap(
  entry: TimeEntryWithCap, 
  now: Date, 
  reminderMinutes: number = CAP_REMINDER_OFFSET_MINUTES
): boolean {
  if (entry.flagStatus === FlagStatus.OVER_CAP) {
    return false; // Already over cap
  }
  
  const netWorkSeconds = getNetWorkSeconds(entry, now);
  const capSeconds = getCapSeconds(entry);
  const reminderSeconds = reminderMinutes * 60;
  
  return netWorkSeconds >= (capSeconds - reminderSeconds) && netWorkSeconds < capSeconds;
}

/**
 * Check if entry has exceeded the cap.
 */
export function isOverCap(entry: TimeEntryWithCap, now: Date): boolean {
  return getNetWorkSeconds(entry, now) >= getCapSeconds(entry);
}

/**
 * Create initial cap fields for a new time entry.
 * 
 * @param clockIn The clock-in timestamp
 * @param capMinutes Optional custom cap (defaults to 960 = 16 hours)
 * @returns Object with initial cap field values
 */
export function createInitialCapFields(clockIn: Date, capMinutes: number = DEFAULT_CAP_MINUTES) {
  return {
    state: TimeEntryState.WORKING as TimeEntryStateType,
    workAccumSeconds: 0,
    lastStateChangeAt: clockIn,
    capMinutes,
    flagStatus: FlagStatus.NONE as FlagStatusType,
    overCapAt: null,
  };
}

/**
 * Prepare fields for starting a break.
 * Settles work time before transitioning to ON_BREAK.
 * 
 * @param entry The current entry
 * @param now Current timestamp
 * @returns Object with updated field values
 */
export function prepareStartBreak<T extends MutableTimeEntry>(entry: T, now: Date): T {
  // Settle accumulated work time before switching to break
  settleWork(entry, now);
  entry.state = TimeEntryState.ON_BREAK;
  entry.lastStateChangeAt = now;
  return entry;
}

/**
 * Prepare fields for ending a break.
 * Sets state back to WORKING.
 * 
 * @param entry The current entry
 * @param now Current timestamp
 * @returns Object with updated field values
 */
export function prepareEndBreak<T extends MutableTimeEntry>(entry: T, now: Date): T {
  entry.state = TimeEntryState.WORKING;
  entry.lastStateChangeAt = now;
  return entry;
}

/**
 * Prepare fields for clocking out.
 * Settles work time and applies soft cap flag if needed.
 * 
 * @param entry The current entry
 * @param now Current timestamp
 * @returns Object with updated field values
 */
export function prepareClockOut<T extends MutableTimeEntry>(entry: T, now: Date): T {
  // Settle work time if still working
  if (entry.state === TimeEntryState.WORKING) {
    settleWork(entry, now);
  }
  
  // Apply soft cap flag if needed
  applySoftCapFlag(entry, now);
  
  entry.state = TimeEntryState.CLOCKED_OUT;
  return entry;
}

/**
 * Calculate duration hours excluding break time.
 * This is compatible with the existing durationHours field.
 * 
 * @param entry The time entry with cap fields
 * @returns Duration in hours (net work time)
 */
export function calculateDurationHours(entry: TimeEntryWithCap): number {
  // For clocked out entries, workAccumSeconds contains the total net work time
  return entry.workAccumSeconds / 3600;
}

