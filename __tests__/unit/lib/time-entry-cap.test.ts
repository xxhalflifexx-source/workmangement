/**
 * Unit tests for soft cap logic
 * Tests the 16-hour net work time cap (breaks excluded)
 */

import {
  TimeEntryState,
  FlagStatus,
  settleWork,
  getNetWorkSeconds,
  getNetWorkHours,
  getCapSeconds,
  computeOverCapAt,
  applySoftCapFlag,
  getEffectiveNetWorkSeconds,
  getEffectiveNetWorkHours,
  isApproachingCap,
  isOverCap,
  createInitialCapFields,
  prepareStartBreak,
  prepareEndBreak,
  prepareClockOut,
  calculateDurationHours,
  DEFAULT_CAP_MINUTES,
  CAP_REMINDER_OFFSET_MINUTES,
  type TimeEntryWithCap,
  type MutableTimeEntry,
} from "@/lib/time-entry-cap";

// Helper to create a mock time entry
function createMockEntry(overrides: Partial<MutableTimeEntry> = {}): MutableTimeEntry {
  const clockIn = new Date("2026-01-03T08:00:00Z");
  return {
    id: "entry-1",
    clockIn,
    clockOut: null,
    state: TimeEntryState.WORKING,
    workAccumSeconds: 0,
    lastStateChangeAt: clockIn,
    capMinutes: DEFAULT_CAP_MINUTES,
    flagStatus: FlagStatus.NONE,
    overCapAt: null,
    ...overrides,
  };
}

describe("Time Entry Cap Logic", () => {
  describe("Constants", () => {
    it("should have default cap of 960 minutes (16 hours)", () => {
      expect(DEFAULT_CAP_MINUTES).toBe(960);
    });

    it("should have reminder offset of 30 minutes", () => {
      expect(CAP_REMINDER_OFFSET_MINUTES).toBe(30);
    });
  });

  describe("settleWork", () => {
    it("should accumulate work time while WORKING", () => {
      const entry = createMockEntry({
        state: TimeEntryState.WORKING,
        lastStateChangeAt: new Date("2026-01-03T08:00:00Z"),
        workAccumSeconds: 0,
      });
      
      const now = new Date("2026-01-03T10:00:00Z"); // 2 hours later
      settleWork(entry, now);
      
      expect(entry.workAccumSeconds).toBe(2 * 60 * 60); // 7200 seconds
      expect(entry.lastStateChangeAt).toEqual(now);
    });

    it("should NOT accumulate time during ON_BREAK", () => {
      const entry = createMockEntry({
        state: TimeEntryState.ON_BREAK,
        lastStateChangeAt: new Date("2026-01-03T12:00:00Z"),
        workAccumSeconds: 4 * 60 * 60, // 4 hours accumulated
      });
      
      const now = new Date("2026-01-03T13:00:00Z"); // 1 hour later
      settleWork(entry, now);
      
      expect(entry.workAccumSeconds).toBe(4 * 60 * 60); // Still 4 hours
      expect(entry.lastStateChangeAt).toEqual(now);
    });

    it("should NOT accumulate time when CLOCKED_OUT", () => {
      const entry = createMockEntry({
        state: TimeEntryState.CLOCKED_OUT,
        lastStateChangeAt: new Date("2026-01-03T17:00:00Z"),
        workAccumSeconds: 8 * 60 * 60,
      });
      
      const now = new Date("2026-01-03T20:00:00Z");
      settleWork(entry, now);
      
      expect(entry.workAccumSeconds).toBe(8 * 60 * 60);
    });

    it("should handle null lastStateChangeAt gracefully", () => {
      const entry = createMockEntry({
        state: TimeEntryState.WORKING,
        lastStateChangeAt: null,
        workAccumSeconds: 0,
      });
      
      const now = new Date("2026-01-03T10:00:00Z");
      settleWork(entry, now);
      
      expect(entry.workAccumSeconds).toBe(0);
      expect(entry.lastStateChangeAt).toEqual(now);
    });
  });

  describe("getNetWorkSeconds", () => {
    it("should include elapsed time when WORKING", () => {
      const entry = createMockEntry({
        state: TimeEntryState.WORKING,
        lastStateChangeAt: new Date("2026-01-03T08:00:00Z"),
        workAccumSeconds: 3600, // 1 hour accumulated
      });
      
      const now = new Date("2026-01-03T10:00:00Z"); // 2 hours since last state change
      const netSeconds = getNetWorkSeconds(entry, now);
      
      expect(netSeconds).toBe(3600 + 7200); // 1h accum + 2h elapsed = 3h
    });

    it("should only return accumulated time when ON_BREAK", () => {
      const entry = createMockEntry({
        state: TimeEntryState.ON_BREAK,
        lastStateChangeAt: new Date("2026-01-03T12:00:00Z"),
        workAccumSeconds: 4 * 3600, // 4 hours accumulated
      });
      
      const now = new Date("2026-01-03T13:00:00Z"); // 1 hour later (on break)
      const netSeconds = getNetWorkSeconds(entry, now);
      
      expect(netSeconds).toBe(4 * 3600); // Only accumulated time, break time not counted
    });

    it("should only return accumulated time when CLOCKED_OUT", () => {
      const entry = createMockEntry({
        state: TimeEntryState.CLOCKED_OUT,
        lastStateChangeAt: new Date("2026-01-03T17:00:00Z"),
        workAccumSeconds: 8 * 3600,
      });
      
      const now = new Date("2026-01-03T20:00:00Z");
      const netSeconds = getNetWorkSeconds(entry, now);
      
      expect(netSeconds).toBe(8 * 3600);
    });
  });

  describe("getNetWorkHours", () => {
    it("should convert seconds to hours correctly", () => {
      const entry = createMockEntry({
        state: TimeEntryState.CLOCKED_OUT,
        workAccumSeconds: 8 * 3600,
      });
      
      const now = new Date();
      expect(getNetWorkHours(entry, now)).toBe(8);
    });
  });

  describe("Multiple work segments separated by breaks", () => {
    it("should sum work time correctly across work-break-work pattern", () => {
      // Simulate: Work 4h -> Break 1h -> Work 4h = 8h net work, 9h wall clock
      const entry = createMockEntry({
        clockIn: new Date("2026-01-03T08:00:00Z"),
        state: TimeEntryState.WORKING,
        lastStateChangeAt: new Date("2026-01-03T08:00:00Z"),
        workAccumSeconds: 0,
      });

      // Work for 4 hours
      let now = new Date("2026-01-03T12:00:00Z");
      prepareStartBreak(entry, now);
      expect(entry.workAccumSeconds).toBe(4 * 3600);
      expect(entry.state).toBe(TimeEntryState.ON_BREAK);

      // Break for 1 hour (no work time added)
      now = new Date("2026-01-03T13:00:00Z");
      prepareEndBreak(entry, now);
      expect(entry.workAccumSeconds).toBe(4 * 3600); // Still 4 hours
      expect(entry.state).toBe(TimeEntryState.WORKING);

      // Work for another 4 hours
      now = new Date("2026-01-03T17:00:00Z");
      const netSeconds = getNetWorkSeconds(entry, now);
      expect(netSeconds).toBe(8 * 3600); // 4h + 4h = 8h
    });
  });

  describe("Soft Cap Flagging", () => {
    it("should flag OVER_CAP at exactly 16h net work", () => {
      const entry = createMockEntry({
        state: TimeEntryState.WORKING,
        lastStateChangeAt: new Date("2026-01-03T08:00:00Z"),
        workAccumSeconds: 15 * 3600, // 15 hours accumulated
        capMinutes: 960,
      });

      // Exactly at 16 hours
      const now = new Date("2026-01-03T09:00:00Z"); // +1 hour = 16h total
      applySoftCapFlag(entry, now);
      
      expect(entry.flagStatus).toBe(FlagStatus.OVER_CAP);
      expect(entry.overCapAt).not.toBeNull();
    });

    it("should flag OVER_CAP with breaks excluded", () => {
      // Work 15h, Break 2h, Work 1h => flags at 16h net work, not at 18h wall clock
      const clockIn = new Date("2026-01-03T06:00:00Z");
      const entry = createMockEntry({
        clockIn,
        state: TimeEntryState.WORKING,
        lastStateChangeAt: clockIn,
        workAccumSeconds: 0,
        capMinutes: 960,
      });

      // Work 15 hours
      let now = new Date("2026-01-03T21:00:00Z");
      prepareStartBreak(entry, now);
      expect(entry.workAccumSeconds).toBe(15 * 3600);
      expect(entry.flagStatus).toBe(FlagStatus.NONE); // Not yet flagged

      // Break 2 hours
      now = new Date("2026-01-03T23:00:00Z");
      prepareEndBreak(entry, now);
      expect(entry.workAccumSeconds).toBe(15 * 3600); // Still 15h
      applySoftCapFlag(entry, now);
      expect(entry.flagStatus).toBe(FlagStatus.NONE); // Still not flagged

      // Work 1 more hour (16h total now)
      now = new Date("2026-01-04T00:00:00Z");
      applySoftCapFlag(entry, now);
      expect(entry.flagStatus).toBe(FlagStatus.OVER_CAP);
      
      // Wall clock is 18 hours (6am to midnight), but net work is 16h
      const netHours = getNetWorkHours(entry, now);
      expect(netHours).toBe(16);
    });

    it("should NOT flag when under cap", () => {
      const entry = createMockEntry({
        state: TimeEntryState.WORKING,
        lastStateChangeAt: new Date("2026-01-03T08:00:00Z"),
        workAccumSeconds: 7 * 3600, // 7 hours accumulated
      });

      const now = new Date("2026-01-03T09:00:00Z"); // +1 hour = 8h total
      applySoftCapFlag(entry, now);
      
      expect(entry.flagStatus).toBe(FlagStatus.NONE);
      expect(entry.overCapAt).toBeNull();
    });

    it("should compute accurate over_cap_at (crossing timestamp)", () => {
      const lastStateChange = new Date("2026-01-03T08:00:00Z");
      const entry = createMockEntry({
        state: TimeEntryState.WORKING,
        lastStateChangeAt: lastStateChange,
        workAccumSeconds: 15 * 3600 + 30 * 60, // 15h 30min
        capMinutes: 960,
      });

      // 1 hour later = 16h 30min total, crossed cap 30 min ago
      const now = new Date("2026-01-03T09:00:00Z");
      applySoftCapFlag(entry, now);
      
      expect(entry.flagStatus).toBe(FlagStatus.OVER_CAP);
      
      // overCapAt should be 30 minutes into this work segment
      const expectedOverCapAt = new Date(lastStateChange.getTime() + 30 * 60 * 1000);
      expect(entry.overCapAt?.getTime()).toBe(expectedOverCapAt.getTime());
    });
  });

  describe("Effective Net Work (Costing/Payroll)", () => {
    it("should cap effective net work at 16h when flagged OVER_CAP", () => {
      const entry = createMockEntry({
        state: TimeEntryState.CLOCKED_OUT,
        workAccumSeconds: 20 * 3600, // 20 hours raw
        flagStatus: FlagStatus.OVER_CAP,
        capMinutes: 960,
      });

      const now = new Date();
      const effectiveSeconds = getEffectiveNetWorkSeconds(entry, now);
      const effectiveHours = getEffectiveNetWorkHours(entry, now);
      
      expect(effectiveSeconds).toBe(16 * 3600);
      expect(effectiveHours).toBe(16);
    });

    it("should NOT cap effective net work when not flagged", () => {
      const entry = createMockEntry({
        state: TimeEntryState.CLOCKED_OUT,
        workAccumSeconds: 10 * 3600,
        flagStatus: FlagStatus.NONE,
      });

      const now = new Date();
      expect(getEffectiveNetWorkHours(entry, now)).toBe(10);
    });

    it("should allow raw net work to exceed cap for admin review", () => {
      const entry = createMockEntry({
        state: TimeEntryState.CLOCKED_OUT,
        workAccumSeconds: 24 * 3600, // 24 hours
        flagStatus: FlagStatus.OVER_CAP,
      });

      const now = new Date();
      
      // Raw net work shows full time
      expect(getNetWorkHours(entry, now)).toBe(24);
      
      // Effective is capped
      expect(getEffectiveNetWorkHours(entry, now)).toBe(16);
    });
  });

  describe("isApproachingCap", () => {
    it("should return true when within 30 minutes of cap", () => {
      const entry = createMockEntry({
        state: TimeEntryState.WORKING,
        lastStateChangeAt: new Date("2026-01-03T08:00:00Z"),
        workAccumSeconds: 15 * 3600 + 40 * 60, // 15h 40min
        capMinutes: 960,
      });

      // +10 minutes = 15h 50min (within 30 min of 16h)
      const now = new Date("2026-01-03T08:10:00Z");
      expect(isApproachingCap(entry, now)).toBe(true);
    });

    it("should return false when already over cap", () => {
      const entry = createMockEntry({
        workAccumSeconds: 17 * 3600,
        flagStatus: FlagStatus.OVER_CAP,
      });

      const now = new Date();
      expect(isApproachingCap(entry, now)).toBe(false);
    });
  });

  describe("isOverCap", () => {
    it("should return true when net work >= cap", () => {
      const entry = createMockEntry({
        state: TimeEntryState.CLOCKED_OUT,
        workAccumSeconds: 16 * 3600,
        capMinutes: 960,
      });

      const now = new Date();
      expect(isOverCap(entry, now)).toBe(true);
    });

    it("should return false when under cap", () => {
      const entry = createMockEntry({
        state: TimeEntryState.CLOCKED_OUT,
        workAccumSeconds: 8 * 3600,
        capMinutes: 960,
      });

      const now = new Date();
      expect(isOverCap(entry, now)).toBe(false);
    });
  });

  describe("createInitialCapFields", () => {
    it("should create correct initial values", () => {
      const clockIn = new Date("2026-01-03T08:00:00Z");
      const fields = createInitialCapFields(clockIn);
      
      expect(fields.state).toBe(TimeEntryState.WORKING);
      expect(fields.workAccumSeconds).toBe(0);
      expect(fields.lastStateChangeAt).toEqual(clockIn);
      expect(fields.capMinutes).toBe(DEFAULT_CAP_MINUTES);
      expect(fields.flagStatus).toBe(FlagStatus.NONE);
      expect(fields.overCapAt).toBeNull();
    });

    it("should allow custom cap minutes", () => {
      const clockIn = new Date();
      const fields = createInitialCapFields(clockIn, 480); // 8 hours
      
      expect(fields.capMinutes).toBe(480);
    });
  });

  describe("prepareStartBreak", () => {
    it("should settle work time before switching to break", () => {
      const entry = createMockEntry({
        state: TimeEntryState.WORKING,
        lastStateChangeAt: new Date("2026-01-03T08:00:00Z"),
        workAccumSeconds: 0,
      });

      const now = new Date("2026-01-03T12:00:00Z"); // 4 hours later
      prepareStartBreak(entry, now);
      
      expect(entry.state).toBe(TimeEntryState.ON_BREAK);
      expect(entry.workAccumSeconds).toBe(4 * 3600);
      expect(entry.lastStateChangeAt).toEqual(now);
    });
  });

  describe("prepareEndBreak", () => {
    it("should switch state to WORKING without adding time", () => {
      const entry = createMockEntry({
        state: TimeEntryState.ON_BREAK,
        lastStateChangeAt: new Date("2026-01-03T12:00:00Z"),
        workAccumSeconds: 4 * 3600,
      });

      const now = new Date("2026-01-03T13:00:00Z"); // 1 hour break
      prepareEndBreak(entry, now);
      
      expect(entry.state).toBe(TimeEntryState.WORKING);
      expect(entry.workAccumSeconds).toBe(4 * 3600); // Unchanged
      expect(entry.lastStateChangeAt).toEqual(now);
    });
  });

  describe("prepareClockOut", () => {
    it("should settle work time and apply cap flag", () => {
      const entry = createMockEntry({
        state: TimeEntryState.WORKING,
        lastStateChangeAt: new Date("2026-01-03T08:00:00Z"),
        workAccumSeconds: 15 * 3600,
      });

      const now = new Date("2026-01-03T10:00:00Z"); // +2 hours = 17h total
      prepareClockOut(entry, now);
      
      expect(entry.state).toBe(TimeEntryState.CLOCKED_OUT);
      expect(entry.workAccumSeconds).toBe(17 * 3600);
      expect(entry.flagStatus).toBe(FlagStatus.OVER_CAP);
    });

    it("should handle clock out from break state", () => {
      const entry = createMockEntry({
        state: TimeEntryState.ON_BREAK,
        lastStateChangeAt: new Date("2026-01-03T12:00:00Z"),
        workAccumSeconds: 4 * 3600,
      });

      const now = new Date("2026-01-03T13:00:00Z");
      prepareClockOut(entry, now);
      
      expect(entry.state).toBe(TimeEntryState.CLOCKED_OUT);
      expect(entry.workAccumSeconds).toBe(4 * 3600); // Break time not added
    });
  });

  describe("Regression Test: Forgot to clock out overnight", () => {
    it("should flag at 16h net work, not at 18h wall clock", () => {
      // Scenario: Employee clocks in at 6am
      // Works 15 hours (until 9pm)
      // Takes 2 hour break (until 11pm)
      // Works 1 more hour (until midnight)
      // Wall clock: 18 hours, Net work: 16 hours
      // Should flag at exactly 16h net work
      
      const clockIn = new Date("2026-01-03T06:00:00Z");
      const entry = createMockEntry({
        clockIn,
        state: TimeEntryState.WORKING,
        lastStateChangeAt: clockIn,
        workAccumSeconds: 0,
        capMinutes: 960,
      });

      // Work 15 hours until 9pm
      let now = new Date("2026-01-03T21:00:00Z");
      settleWork(entry, now);
      expect(entry.workAccumSeconds).toBe(15 * 3600);
      expect(entry.flagStatus).toBe(FlagStatus.NONE);

      // Start 2 hour break
      prepareStartBreak(entry, now);
      expect(entry.state).toBe(TimeEntryState.ON_BREAK);

      // End break at 11pm
      now = new Date("2026-01-03T23:00:00Z");
      prepareEndBreak(entry, now);
      expect(entry.state).toBe(TimeEntryState.WORKING);
      expect(entry.workAccumSeconds).toBe(15 * 3600); // Still 15h

      // Check - should NOT be flagged yet
      applySoftCapFlag(entry, now);
      expect(entry.flagStatus).toBe(FlagStatus.NONE);

      // Work 1 more hour until midnight
      now = new Date("2026-01-04T00:00:00Z");
      
      // Check net work time
      const netWork = getNetWorkSeconds(entry, now);
      expect(netWork).toBe(16 * 3600); // 15h + 1h = 16h
      
      // Apply flag - should be OVER_CAP now
      applySoftCapFlag(entry, now);
      expect(entry.flagStatus).toBe(FlagStatus.OVER_CAP);
      
      // Wall clock from 6am to midnight = 18 hours
      const wallClock = (now.getTime() - clockIn.getTime()) / 1000;
      expect(wallClock).toBe(18 * 3600);
      
      // But net work is only 16 hours (18h - 2h break)
      expect(netWork).toBe(16 * 3600);
    });
  });
});

