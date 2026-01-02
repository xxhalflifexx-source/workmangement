/**
 * Integration tests for QC (Quality Control) workflow
 * Tests the full flow from job creation -> work -> submit to QC -> review -> complete/rework
 */

import { getServerSession } from 'next-auth';

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock email service
jest.mock('@/lib/email', () => ({
  sendJobStatusEmail: jest.fn().mockResolvedValue(undefined),
}));

// Mock prisma with job workflow
const mockPrisma = {
  job: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  jobActivity: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock revalidatePath
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('QC Workflow Integration', () => {
  const adminSession = {
    user: {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      organizationId: 'org-1',
    },
  };

  const employeeSession = {
    user: {
      id: 'employee-id',
      email: 'employee@example.com',
      name: 'Employee',
      role: 'EMPLOYEE',
      organizationId: 'org-1',
    },
  };

  const qcManagerSession = {
    user: {
      id: 'qc-manager-id',
      email: 'qc@example.com',
      name: 'QC Manager',
      role: 'MANAGER',
      organizationId: 'org-1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Job Lifecycle', () => {
    it('should create job in NOT_STARTED status', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(adminSession);
      
      mockPrisma.job.create.mockResolvedValue({
        id: 'job-1',
        title: 'Test Job',
        status: 'NOT_STARTED',
        organizationId: 'org-1',
        createdById: 'admin-id',
      });

      const { createJob } = await import('@/app/jobs/actions');
      
      const formData = new FormData();
      formData.append('title', 'Test Job');
      formData.append('status', 'NOT_STARTED');
      formData.append('priority', 'MEDIUM');

      const result = await createJob(formData);

      expect(result.ok).toBe(true);
      expect(mockPrisma.job.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'NOT_STARTED',
          }),
        })
      );
    });

    it('should allow employee to submit job to QC', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(employeeSession);
      
      const inProgressJob = {
        id: 'job-1',
        title: 'Test Job',
        status: 'IN_PROGRESS',
        assignedTo: 'employee-id',
        organizationId: 'org-1',
        assignee: { email: 'employee@example.com', name: 'Employee' },
        creator: { email: 'admin@example.com', name: 'Admin' },
      };
      
      mockPrisma.job.findUnique.mockResolvedValue(inProgressJob);
      mockPrisma.job.update.mockResolvedValue({
        ...inProgressJob,
        status: 'AWAITING_QC',
      });
      mockPrisma.jobActivity.create.mockResolvedValue({});

      const { submitJobPhotosToQC } = await import('@/app/jobs/actions');
      
      const formData = new FormData();
      formData.append('jobId', 'job-1');

      const result = await submitJobPhotosToQC(formData);

      expect(result.ok).toBe(true);
      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'AWAITING_QC',
          }),
        })
      );
    });

    it('should prevent editing of job in AWAITING_QC status', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(employeeSession);
      
      mockPrisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        title: 'Test Job',
        status: 'AWAITING_QC',
        organizationId: 'org-1',
      });

      const { updateJob } = await import('@/app/jobs/actions');
      
      const formData = new FormData();
      formData.append('id', 'job-1');
      formData.append('title', 'Trying to edit');
      formData.append('status', 'IN_PROGRESS');

      const result = await updateJob(formData);

      // Should fail or be restricted when job is in QC
      // The actual behavior depends on implementation
      expect(mockPrisma.job.update).not.toHaveBeenCalled();
    });

    it('should allow QC manager to approve job to COMPLETED', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(qcManagerSession);
      
      const awaitingQCJob = {
        id: 'job-1',
        title: 'Test Job',
        status: 'AWAITING_QC',
        organizationId: 'org-1',
        assignee: { email: 'employee@example.com' },
        creator: { email: 'admin@example.com' },
      };
      
      mockPrisma.job.findUnique.mockResolvedValue(awaitingQCJob);
      mockPrisma.job.update.mockResolvedValue({
        ...awaitingQCJob,
        status: 'COMPLETED',
      });

      const { approveJob } = await import('@/app/qc/actions');
      const result = await approveJob('job-1');

      expect(result.ok).toBe(true);
      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      );
    });

    it('should allow QC manager to send job back for REWORK', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(qcManagerSession);
      
      const awaitingQCJob = {
        id: 'job-1',
        title: 'Test Job',
        status: 'AWAITING_QC',
        organizationId: 'org-1',
        assignee: { email: 'employee@example.com' },
        creator: { email: 'admin@example.com' },
      };
      
      mockPrisma.job.findUnique.mockResolvedValue(awaitingQCJob);
      mockPrisma.job.update.mockResolvedValue({
        ...awaitingQCJob,
        status: 'REWORK',
      });

      const { rejectJob } = await import('@/app/qc/actions');
      const result = await rejectJob('job-1', 'Needs more work on section A');

      expect(result.ok).toBe(true);
      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REWORK',
          }),
        })
      );
    });
  });

  describe('QC Queue', () => {
    it('should show jobs awaiting QC to managers', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(qcManagerSession);
      
      const qcJobs = [
        { id: 'job-1', title: 'Job 1', status: 'AWAITING_QC' },
        { id: 'job-2', title: 'Job 2', status: 'AWAITING_QC' },
      ];
      
      mockPrisma.job.findMany.mockResolvedValue(qcJobs);
      mockPrisma.job.count.mockResolvedValue(2);

      const { getQCJobs } = await import('@/app/qc/actions');
      const result = await getQCJobs();

      expect(result.ok).toBe(true);
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs?.every((j: any) => j.status === 'AWAITING_QC')).toBe(true);
    });

    it('should not show QC queue to employees', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(employeeSession);
      
      const { getQCJobs } = await import('@/app/qc/actions');
      const result = await getQCJobs();

      // Should either return empty or error based on permissions
      if (result.ok) {
        expect(result.jobs).toHaveLength(0);
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Job Activity Tracking', () => {
    it('should record activity when job is submitted to QC', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(employeeSession);
      
      mockPrisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'IN_PROGRESS',
        assignedTo: 'employee-id',
        assignee: { email: 'e@e.com', name: 'E' },
        creator: { email: 'a@a.com', name: 'A' },
      });
      mockPrisma.job.update.mockResolvedValue({ id: 'job-1', status: 'AWAITING_QC' });
      mockPrisma.jobActivity.create.mockResolvedValue({});

      const { submitJobPhotosToQC } = await import('@/app/jobs/actions');
      
      const formData = new FormData();
      formData.append('jobId', 'job-1');

      await submitJobPhotosToQC(formData);

      expect(mockPrisma.jobActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: 'job-1',
            userId: 'employee-id',
            type: 'UPDATE',
          }),
        })
      );
    });

    it('should record activity when job is approved', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(qcManagerSession);
      
      mockPrisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'AWAITING_QC',
        assignee: { email: 'e@e.com' },
        creator: { email: 'a@a.com' },
      });
      mockPrisma.job.update.mockResolvedValue({ id: 'job-1', status: 'COMPLETED' });
      mockPrisma.jobActivity.create.mockResolvedValue({});

      const { approveJob } = await import('@/app/qc/actions');
      await approveJob('job-1');

      expect(mockPrisma.jobActivity.create).toHaveBeenCalled();
    });
  });
});

