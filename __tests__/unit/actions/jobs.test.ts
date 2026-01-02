/**
 * Tests for job-related server actions
 * Note: These tests mock the database and auth to test business logic
 */

import { getServerSession } from 'next-auth';

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock prisma
const mockPrisma = {
  job: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  jobActivity: {
    create: jest.fn(),
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

describe('Jobs Actions', () => {
  const mockAdminSession = {
    user: {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      organizationId: 'org-1',
    },
  };

  const mockEmployeeSession = {
    user: {
      id: 'employee-id',
      email: 'employee@example.com',
      name: 'Employee User',
      role: 'EMPLOYEE',
      organizationId: 'org-1',
    },
  };

  const mockJob = {
    id: 'job-1',
    title: 'Test Job',
    description: 'Test Description',
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    organizationId: 'org-1',
    createdById: 'admin-id',
    assignedTo: 'employee-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
  });

  describe('getJobs', () => {
    it('should return jobs for authenticated users', async () => {
      mockPrisma.job.findMany.mockResolvedValue([mockJob]);
      mockPrisma.job.count.mockResolvedValue(1);

      // Import after mocks are set up
      const { getJobs } = await import('@/app/jobs/actions');
      const result = await getJobs({ page: 1, pageSize: 10 });

      expect(result.ok).toBe(true);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].id).toBe('job-1');
    });

    it('should return error for unauthenticated users', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const { getJobs } = await import('@/app/jobs/actions');
      const result = await getJobs({ page: 1, pageSize: 10 });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('authenticated');
    });

    it('should filter by status when provided', async () => {
      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);

      const { getJobs } = await import('@/app/jobs/actions');
      await getJobs({ page: 1, pageSize: 10, status: 'IN_PROGRESS' });

      expect(mockPrisma.job.findMany).toHaveBeenCalled();
      const call = mockPrisma.job.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('IN_PROGRESS');
    });

    it('should paginate results correctly', async () => {
      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(50);

      const { getJobs } = await import('@/app/jobs/actions');
      const result = await getJobs({ page: 2, pageSize: 10 });

      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // Page 2 with pageSize 10
          take: 10,
        })
      );
      expect(result.totalPages).toBe(5);
    });
  });

  describe('createJob', () => {
    it('should create a job with valid data', async () => {
      mockPrisma.job.create.mockResolvedValue({
        ...mockJob,
        id: 'new-job-id',
      });

      const { createJob } = await import('@/app/jobs/actions');
      
      const formData = new FormData();
      formData.append('title', 'New Job');
      formData.append('description', 'New Description');
      formData.append('priority', 'HIGH');
      formData.append('status', 'NOT_STARTED');

      const result = await createJob(formData);

      expect(result.ok).toBe(true);
      expect(mockPrisma.job.create).toHaveBeenCalled();
    });

    it('should require title', async () => {
      const { createJob } = await import('@/app/jobs/actions');
      
      const formData = new FormData();
      formData.append('description', 'No title job');
      formData.append('priority', 'LOW');

      const result = await createJob(formData);

      expect(result.ok).toBe(false);
    });

    it('should allow employees to create jobs', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockEmployeeSession);
      mockPrisma.job.create.mockResolvedValue({
        ...mockJob,
        createdById: 'employee-id',
      });

      const { createJob } = await import('@/app/jobs/actions');
      
      const formData = new FormData();
      formData.append('title', 'Employee Created Job');
      formData.append('description', 'Created by employee');
      formData.append('priority', 'MEDIUM');
      formData.append('status', 'NOT_STARTED');

      const result = await createJob(formData);

      expect(result.ok).toBe(true);
    });
  });

  describe('updateJob', () => {
    it('should update job with valid data', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockPrisma.job.update.mockResolvedValue({
        ...mockJob,
        title: 'Updated Title',
      });

      const { updateJob } = await import('@/app/jobs/actions');
      
      const formData = new FormData();
      formData.append('id', 'job-1');
      formData.append('title', 'Updated Title');
      formData.append('description', 'Updated Description');
      formData.append('priority', 'HIGH');
      formData.append('status', 'IN_PROGRESS');

      const result = await updateJob(formData);

      expect(result.ok).toBe(true);
    });

    it('should allow status change to AWAITING_QC', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ...mockJob,
        status: 'IN_PROGRESS',
      });
      mockPrisma.job.update.mockResolvedValue({
        ...mockJob,
        status: 'AWAITING_QC',
      });

      const { updateJob } = await import('@/app/jobs/actions');
      
      const formData = new FormData();
      formData.append('id', 'job-1');
      formData.append('title', 'Test Job');
      formData.append('status', 'AWAITING_QC');

      const result = await updateJob(formData);

      expect(result.ok).toBe(true);
    });
  });

  describe('deleteJob', () => {
    it('should delete job for admin', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockPrisma.job.delete.mockResolvedValue(mockJob);

      const { deleteJob } = await import('@/app/jobs/actions');
      const result = await deleteJob('job-1');

      expect(result.ok).toBe(true);
      expect(mockPrisma.job.delete).toHaveBeenCalledWith({
        where: { id: 'job-1' },
      });
    });

    it('should return error if job not found', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      const { deleteJob } = await import('@/app/jobs/actions');
      const result = await deleteJob('nonexistent-id');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});

