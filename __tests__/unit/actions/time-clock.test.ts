/**
 * Tests for time clock server actions
 */

import { getServerSession } from 'next-auth';

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock prisma
const mockPrisma = {
  timeEntry: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  job: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock revalidatePath
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('Time Clock Actions', () => {
  const mockSession = {
    user: {
      id: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
      role: 'EMPLOYEE',
      organizationId: 'org-1',
    },
  };

  const mockTimeEntry = {
    id: 'entry-1',
    userId: 'user-id',
    clockIn: new Date('2026-01-02T09:00:00'),
    clockOut: null,
    breakStart: null,
    breakEnd: null,
    jobId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    // Reset date mocking
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-02T12:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('clockIn', () => {
    it('should create a new time entry on clock in', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue(null); // No active entry
      mockPrisma.timeEntry.create.mockResolvedValue({
        ...mockTimeEntry,
        id: 'new-entry',
      });

      const { clockIn } = await import('@/app/time-clock/actions');
      const result = await clockIn();

      expect(result.ok).toBe(true);
      expect(mockPrisma.timeEntry.create).toHaveBeenCalled();
    });

    it('should not allow clock in when already clocked in', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue(mockTimeEntry); // Active entry exists

      const { clockIn } = await import('@/app/time-clock/actions');
      const result = await clockIn();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('already clocked in');
    });

    it('should require authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const { clockIn } = await import('@/app/time-clock/actions');
      const result = await clockIn();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('authenticated');
    });

    it('should allow clock in with job ID', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue(null);
      mockPrisma.timeEntry.create.mockResolvedValue({
        ...mockTimeEntry,
        jobId: 'job-1',
      });

      const { clockIn } = await import('@/app/time-clock/actions');
      const result = await clockIn('job-1');

      expect(result.ok).toBe(true);
      expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: 'job-1',
          }),
        })
      );
    });
  });

  describe('clockOut', () => {
    it('should update time entry with clock out time', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue(mockTimeEntry);
      mockPrisma.timeEntry.update.mockResolvedValue({
        ...mockTimeEntry,
        clockOut: new Date(),
      });

      const { clockOut } = await import('@/app/time-clock/actions');
      const result = await clockOut();

      expect(result.ok).toBe(true);
      expect(mockPrisma.timeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'entry-1' },
          data: expect.objectContaining({
            clockOut: expect.any(Date),
          }),
        })
      );
    });

    it('should not allow clock out when not clocked in', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue(null);

      const { clockOut } = await import('@/app/time-clock/actions');
      const result = await clockOut();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not clocked in');
    });

    it('should end break before clocking out if on break', async () => {
      const entryOnBreak = {
        ...mockTimeEntry,
        breakStart: new Date('2026-01-02T11:00:00'),
        breakEnd: null,
      };
      mockPrisma.timeEntry.findFirst.mockResolvedValue(entryOnBreak);
      mockPrisma.timeEntry.update.mockResolvedValue({
        ...entryOnBreak,
        breakEnd: new Date(),
        clockOut: new Date(),
      });

      const { clockOut } = await import('@/app/time-clock/actions');
      const result = await clockOut();

      expect(result.ok).toBe(true);
    });
  });

  describe('startBreak', () => {
    it('should start a break for active time entry', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue(mockTimeEntry);
      mockPrisma.timeEntry.update.mockResolvedValue({
        ...mockTimeEntry,
        breakStart: new Date(),
      });

      const { startBreak } = await import('@/app/time-clock/actions');
      const result = await startBreak();

      expect(result.ok).toBe(true);
      expect(mockPrisma.timeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            breakStart: expect.any(Date),
          }),
        })
      );
    });

    it('should not allow break when not clocked in', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue(null);

      const { startBreak } = await import('@/app/time-clock/actions');
      const result = await startBreak();

      expect(result.ok).toBe(false);
    });

    it('should not allow break when already on break', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue({
        ...mockTimeEntry,
        breakStart: new Date(),
        breakEnd: null,
      });

      const { startBreak } = await import('@/app/time-clock/actions');
      const result = await startBreak();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('already on break');
    });
  });

  describe('endBreak', () => {
    it('should end a break', async () => {
      const entryOnBreak = {
        ...mockTimeEntry,
        breakStart: new Date('2026-01-02T11:00:00'),
        breakEnd: null,
      };
      mockPrisma.timeEntry.findFirst.mockResolvedValue(entryOnBreak);
      mockPrisma.timeEntry.update.mockResolvedValue({
        ...entryOnBreak,
        breakEnd: new Date(),
      });

      const { endBreak } = await import('@/app/time-clock/actions');
      const result = await endBreak();

      expect(result.ok).toBe(true);
      expect(mockPrisma.timeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            breakEnd: expect.any(Date),
          }),
        })
      );
    });

    it('should not allow end break when not on break', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue(mockTimeEntry); // Not on break

      const { endBreak } = await import('@/app/time-clock/actions');
      const result = await endBreak();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not on break');
    });
  });

  describe('getCurrentTimeEntry', () => {
    it('should return current active time entry', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue(mockTimeEntry);

      const { getCurrentTimeEntry } = await import('@/app/time-clock/actions');
      const result = await getCurrentTimeEntry();

      expect(result.ok).toBe(true);
      expect(result.entry).toEqual(mockTimeEntry);
    });

    it('should return null when no active entry', async () => {
      mockPrisma.timeEntry.findFirst.mockResolvedValue(null);

      const { getCurrentTimeEntry } = await import('@/app/time-clock/actions');
      const result = await getCurrentTimeEntry();

      expect(result.ok).toBe(true);
      expect(result.entry).toBeNull();
    });
  });
});

