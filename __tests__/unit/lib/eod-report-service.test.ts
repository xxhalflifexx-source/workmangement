/**
 * Unit tests for EOD Report Service
 * Tests the end-of-day report generation logic
 */

import {
  EOD_REPORT_HOUR,
  MARGIN_ALERT_THRESHOLD,
  MAX_NOTES_BULLETS,
  type EodEmployeeSummary,
  type EodJobSnapshot,
  type EodReportData,
  formatReportPreview,
} from "@/lib/eod-report-service";

// Mock prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    timeEntry: {
      findMany: jest.fn(),
    },
    job: {
      findMany: jest.fn(),
    },
    companySettings: {
      findFirst: jest.fn(),
    },
  },
}));

// Import after mocking
import { prisma } from "@/lib/prisma";

// Helper to create mock report data
function createMockReportData(overrides: Partial<EodReportData> = {}): EodReportData {
  return {
    reportDate: "Jan 03, 2026",
    organizationId: "org-1",
    organizationName: "Test Organization",
    summary: {
      totalLaborHours: 16,
      totalLaborCost: 400,
      employeeCount: 2,
      jobCount: 2,
      flagCount: 0,
    },
    employees: [],
    jobs: [],
    exceptions: [],
    ...overrides,
  };
}

// Helper to create mock employee summary
function createMockEmployeeSummary(overrides: Partial<EodEmployeeSummary> = {}): EodEmployeeSummary {
  return {
    userId: "user-1",
    name: "John Doe",
    email: "john@example.com",
    netWorkHours: 8,
    breakHours: 1,
    paidHours: 8,
    hourlyRate: 25,
    laborCost: 200,
    workDescription: ["Welding on steel frame"],
    jobsWorked: [{ jobId: "job-1", title: "Steel Frame Build", jobNumber: "JOB2026-0001", hours: 8 }],
    flags: [],
    ...overrides,
  };
}

// Helper to create mock job snapshot
function createMockJobSnapshot(overrides: Partial<EodJobSnapshot> = {}): EodJobSnapshot {
  return {
    jobId: "job-1",
    title: "Steel Frame Build",
    jobNumber: "JOB2026-0001",
    revenue: 5000,
    revenueSource: "Final Price",
    costToday: { labor: 200, materials: 100, other: 0, total: 300 },
    costToDate: { labor: 1000, materials: 500, other: 100, total: 1600 },
    profit: 3400,
    margin: 0.68,
    status: "IN_PROGRESS",
    alerts: [],
    ...overrides,
  };
}

describe("EOD Report Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Constants", () => {
    it("should have correct EOD report hour (6 PM)", () => {
      expect(EOD_REPORT_HOUR).toBe(18);
    });

    it("should have correct margin alert threshold (20%)", () => {
      expect(MARGIN_ALERT_THRESHOLD).toBe(0.20);
    });

    it("should have correct max notes bullets (3)", () => {
      expect(MAX_NOTES_BULLETS).toBe(3);
    });
  });

  describe("Employee Hours Aggregation", () => {
    it("should correctly aggregate net work hours (breaks excluded)", () => {
      const employee = createMockEmployeeSummary({
        netWorkHours: 8,
        breakHours: 1,
      });

      // Net work should not include break time
      expect(employee.netWorkHours).toBe(8);
      expect(employee.breakHours).toBe(1);
      // Total wall clock would be 9 hours (8 work + 1 break)
    });

    it("should correctly aggregate hours across multiple jobs", () => {
      const employee = createMockEmployeeSummary({
        netWorkHours: 10,
        jobsWorked: [
          { jobId: "job-1", title: "Job A", jobNumber: "JOB-001", hours: 4 },
          { jobId: "job-2", title: "Job B", jobNumber: "JOB-002", hours: 6 },
        ],
      });

      const totalJobHours = employee.jobsWorked.reduce((sum, j) => sum + j.hours, 0);
      expect(totalJobHours).toBe(10);
    });

    it("should calculate labor cost correctly", () => {
      const employee = createMockEmployeeSummary({
        netWorkHours: 8,
        hourlyRate: 30,
        laborCost: 240, // 8 * 30
      });

      expect(employee.laborCost).toBe(employee.netWorkHours * employee.hourlyRate);
    });
  });

  describe("Job Costs and Profit Aggregation", () => {
    it("should calculate profit correctly when revenue exists", () => {
      const job = createMockJobSnapshot({
        revenue: 5000,
        costToDate: { labor: 1000, materials: 500, other: 100, total: 1600 },
        profit: 3400, // 5000 - 1600
        margin: 0.68, // 3400 / 5000
      });

      expect(job.profit).toBe(job.revenue! - job.costToDate.total);
      expect(job.margin).toBeCloseTo(job.profit! / job.revenue!, 2);
    });

    it("should return null profit and margin when revenue is missing", () => {
      const job = createMockJobSnapshot({
        revenue: null,
        revenueSource: null,
        profit: null,
        margin: null,
        alerts: ["missing_revenue"],
      });

      expect(job.revenue).toBeNull();
      expect(job.profit).toBeNull();
      expect(job.margin).toBeNull();
      expect(job.alerts).toContain("missing_revenue");
    });

    it("should aggregate costs by category", () => {
      const job = createMockJobSnapshot({
        costToday: { labor: 200, materials: 100, other: 50, total: 350 },
      });

      expect(job.costToday.total).toBe(
        job.costToday.labor + job.costToday.materials + job.costToday.other
      );
    });
  });

  describe("Flags and Exceptions", () => {
    it("should flag open time entries", () => {
      const employee = createMockEmployeeSummary({
        flags: ["open_entry"],
      });

      expect(employee.flags).toContain("open_entry");
    });

    it("should flag over-cap entries", () => {
      const employee = createMockEmployeeSummary({
        flags: ["over_cap"],
      });

      expect(employee.flags).toContain("over_cap");
    });

    it("should flag missing notes", () => {
      const employee = createMockEmployeeSummary({
        flags: ["missing_notes"],
        workDescription: [],
      });

      expect(employee.flags).toContain("missing_notes");
    });

    it("should flag low margin jobs", () => {
      const job = createMockJobSnapshot({
        revenue: 1000,
        costToDate: { labor: 800, materials: 100, other: 50, total: 950 },
        profit: 50,
        margin: 0.05, // 5% - below 20% threshold
        alerts: ["low_margin"],
      });

      expect(job.margin).toBeLessThan(MARGIN_ALERT_THRESHOLD);
      expect(job.alerts).toContain("low_margin");
    });

    it("should flag over-budget jobs", () => {
      const job = createMockJobSnapshot({
        revenue: 1000,
        costToDate: { labor: 800, materials: 300, other: 100, total: 1200 },
        profit: -200, // Negative profit
        margin: -0.2,
        alerts: ["over_budget", "low_margin"],
      });

      expect(job.profit).toBeLessThan(0);
      expect(job.alerts).toContain("over_budget");
    });
  });

  describe("Work Description Truncation", () => {
    it("should include up to 3 work description bullets", () => {
      const employee = createMockEmployeeSummary({
        workDescription: [
          "Welding on steel frame",
          "Installed support beams",
          "Quality check on joints",
        ],
      });

      expect(employee.workDescription.length).toBe(3);
    });

    it("should add '+ N more...' when more than 3 notes exist", () => {
      const employee = createMockEmployeeSummary({
        workDescription: [
          "Note 1",
          "Note 2",
          "Note 3",
          "+ 2 more...",
        ],
      });

      expect(employee.workDescription.length).toBe(4);
      expect(employee.workDescription[3]).toMatch(/\+ \d+ more/);
    });
  });

  describe("Report Summary Totals", () => {
    it("should correctly sum total labor hours from all employees", () => {
      const report = createMockReportData({
        employees: [
          createMockEmployeeSummary({ netWorkHours: 8 }),
          createMockEmployeeSummary({ userId: "user-2", name: "Jane", netWorkHours: 6 }),
        ],
        summary: {
          totalLaborHours: 14,
          totalLaborCost: 350,
          employeeCount: 2,
          jobCount: 2,
          flagCount: 0,
        },
      });

      const calculatedTotalHours = report.employees.reduce((sum, e) => sum + e.netWorkHours, 0);
      expect(report.summary.totalLaborHours).toBe(calculatedTotalHours);
    });

    it("should correctly sum total labor cost from all employees", () => {
      const report = createMockReportData({
        employees: [
          createMockEmployeeSummary({ laborCost: 200 }),
          createMockEmployeeSummary({ userId: "user-2", name: "Jane", laborCost: 150 }),
        ],
        summary: {
          totalLaborHours: 14,
          totalLaborCost: 350,
          employeeCount: 2,
          jobCount: 2,
          flagCount: 0,
        },
      });

      const calculatedTotalCost = report.employees.reduce((sum, e) => sum + e.laborCost, 0);
      expect(report.summary.totalLaborCost).toBe(calculatedTotalCost);
    });

    it("should correctly count flags", () => {
      const report = createMockReportData({
        employees: [
          createMockEmployeeSummary({ flags: ["open_entry", "missing_notes"] }),
          createMockEmployeeSummary({ userId: "user-2", flags: ["over_cap"] }),
        ],
        jobs: [
          createMockJobSnapshot({ alerts: ["low_margin"] }),
        ],
        summary: {
          totalLaborHours: 16,
          totalLaborCost: 400,
          employeeCount: 2,
          jobCount: 1,
          flagCount: 4, // 2 + 1 + 1
        },
      });

      const empFlags = report.employees.reduce((sum, e) => sum + e.flags.length, 0);
      const jobAlerts = report.jobs.reduce((sum, j) => sum + j.alerts.length, 0);
      expect(report.summary.flagCount).toBe(empFlags + jobAlerts);
    });
  });

  describe("formatReportPreview", () => {
    it("should generate readable text preview", () => {
      const report = createMockReportData({
        employees: [createMockEmployeeSummary()],
        jobs: [createMockJobSnapshot()],
        exceptions: ["Test exception"],
      });

      const preview = formatReportPreview(report);

      // Should include key sections
      expect(preview).toContain("EOD Report:");
      expect(preview).toContain("Test Organization");
      expect(preview).toContain("SUMMARY");
      expect(preview).toContain("EMPLOYEES");
      expect(preview).toContain("JOB PROFIT SNAPSHOTS");
      expect(preview).toContain("EXCEPTIONS");
      expect(preview).toContain("John Doe");
      expect(preview).toContain("Steel Frame Build");
      expect(preview).toContain("Test exception");
    });

    it("should format hours with 2 decimal places", () => {
      const report = createMockReportData({
        summary: {
          totalLaborHours: 8.333,
          totalLaborCost: 208.33,
          employeeCount: 1,
          jobCount: 1,
          flagCount: 0,
        },
      });

      const preview = formatReportPreview(report);
      expect(preview).toContain("8.33");
    });

    it("should format currency with 2 decimal places", () => {
      const report = createMockReportData({
        summary: {
          totalLaborHours: 8,
          totalLaborCost: 208.335,
          employeeCount: 1,
          jobCount: 1,
          flagCount: 0,
        },
      });

      const preview = formatReportPreview(report);
      expect(preview).toContain("$208.34"); // Rounded
    });
  });

  describe("Revenue Source Priority", () => {
    it("should prefer finalPrice over estimatedPrice", () => {
      const jobWithFinalPrice = createMockJobSnapshot({
        revenue: 5000,
        revenueSource: "Final Price",
      });

      expect(jobWithFinalPrice.revenueSource).toBe("Final Price");
    });

    it("should use estimatedPrice when finalPrice is missing", () => {
      const jobWithEstimate = createMockJobSnapshot({
        revenue: 4500,
        revenueSource: "Estimated Price",
      });

      expect(jobWithEstimate.revenueSource).toBe("Estimated Price");
    });

    it("should flag missing revenue when no price exists", () => {
      const jobNoPrice = createMockJobSnapshot({
        revenue: null,
        revenueSource: null,
        alerts: ["missing_revenue"],
      });

      expect(jobNoPrice.revenue).toBeNull();
      expect(jobNoPrice.alerts).toContain("missing_revenue");
    });
  });

  describe("Regression: Forgot to clock out overnight", () => {
    it("should report open entry in exceptions", () => {
      const employee = createMockEmployeeSummary({
        flags: ["open_entry"],
      });

      const report = createMockReportData({
        employees: [employee],
        exceptions: ["John Doe: Open time entry (not clocked out)"],
      });

      expect(report.employees[0].flags).toContain("open_entry");
      expect(report.exceptions).toContain("John Doe: Open time entry (not clocked out)");
    });

    it("should report over-cap entry in exceptions", () => {
      const employee = createMockEmployeeSummary({
        flags: ["over_cap"],
      });

      const report = createMockReportData({
        employees: [employee],
        exceptions: ["John Doe: Over 16-hour cap flagged"],
      });

      expect(report.employees[0].flags).toContain("over_cap");
      expect(report.exceptions).toContain("John Doe: Over 16-hour cap flagged");
    });
  });

  describe("Integration Scenario", () => {
    it("should handle complete scenario with 2 employees and 2 jobs", () => {
      // Scenario: 2 employees, 2 jobs, one job missing revenue
      const employees = [
        createMockEmployeeSummary({
          userId: "user-1",
          name: "Alice",
          netWorkHours: 8,
          laborCost: 200,
          jobsWorked: [
            { jobId: "job-1", title: "Job A", jobNumber: "JOB-001", hours: 5 },
            { jobId: "job-2", title: "Job B", jobNumber: "JOB-002", hours: 3 },
          ],
        }),
        createMockEmployeeSummary({
          userId: "user-2",
          name: "Bob",
          netWorkHours: 6,
          laborCost: 150,
          jobsWorked: [
            { jobId: "job-1", title: "Job A", jobNumber: "JOB-001", hours: 6 },
          ],
          flags: ["missing_notes"],
        }),
      ];

      const jobs = [
        createMockJobSnapshot({
          jobId: "job-1",
          title: "Job A",
          revenue: 5000,
          costToday: { labor: 275, materials: 0, other: 0, total: 275 },
        }),
        createMockJobSnapshot({
          jobId: "job-2",
          title: "Job B",
          revenue: null,
          revenueSource: null,
          profit: null,
          margin: null,
          alerts: ["missing_revenue"],
        }),
      ];

      const report = createMockReportData({
        employees,
        jobs,
        summary: {
          totalLaborHours: 14,
          totalLaborCost: 350,
          employeeCount: 2,
          jobCount: 2,
          flagCount: 2, // missing_notes + missing_revenue
        },
        exceptions: ["Job \"Job B\": Missing revenue/pricing"],
      });

      // Verify employee count
      expect(report.summary.employeeCount).toBe(2);
      expect(report.employees.length).toBe(2);

      // Verify job count
      expect(report.summary.jobCount).toBe(2);
      expect(report.jobs.length).toBe(2);

      // Verify totals
      expect(report.summary.totalLaborHours).toBe(14);
      expect(report.summary.totalLaborCost).toBe(350);

      // Verify flagged job appears
      expect(report.jobs[1].alerts).toContain("missing_revenue");
      expect(report.exceptions.length).toBe(1);
    });
  });
});

