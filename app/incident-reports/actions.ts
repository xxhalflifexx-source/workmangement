"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getOrgContext, buildOrgFilter, requireRole } from "@/lib/org-utils";

// Types
export type IncidentStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EmployeeRole = "INVOLVED" | "WITNESS" | "INJURED";

export interface IncidentReportWithRelations {
  id: string;
  title: string;
  description: string;
  incidentDate: Date;
  location: string;
  injuryDetails: string | null;
  witnesses: string | null;
  status: string;
  severity: string;
  photos: string[];
  organizationId: string;
  createdById: string;
  jobId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  job: {
    id: string;
    jobNumber: string | null;
    title: string;
  } | null;
  employeesInvolved: {
    id: string;
    userId: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }[];
}

// Get all incident reports for the organization
export async function getIncidentReports(filters?: {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  jobId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const ctx = await getOrgContext();
  if (!ctx.ok) return ctx;

  // Only admins can manage incident reports
  const roleCheck = requireRole(ctx, "ADMIN");
  if (roleCheck) return roleCheck;

  // Super Admins without org can't create org-specific data
  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Build base where clause with org filter
    let where: any = buildOrgFilter(ctx, {});
    
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.severity) {
      where.severity = filters.severity;
    }
    if (filters?.jobId) {
      where.jobId = filters.jobId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.incidentDate = {};
      if (filters.startDate) {
        where.incidentDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.incidentDate.lte = filters.endDate;
      }
    }

    const reports = await prisma.incidentReport.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        job: {
          select: { id: true, jobNumber: true, title: true },
        },
        employeesInvolved: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { ok: true, reports };
  } catch (err) {
    console.error("[getIncidentReports] Error:", err);
    return { ok: false, error: "Failed to fetch incident reports" };
  }
}

// Get a single incident report by ID
export async function getIncidentReport(id: string) {
  const ctx = await getOrgContext();
  if (!ctx.ok) return ctx;

  // Only admins can view incident reports
  const roleCheck = requireRole(ctx, "ADMIN");
  if (roleCheck) return roleCheck;

  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Build where clause with org filter
    const where = buildOrgFilter(ctx, { id });

    const report = await prisma.incidentReport.findFirst({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        job: {
          select: { id: true, jobNumber: true, title: true },
        },
        employeesInvolved: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!report) {
      return { ok: false, error: "Incident report not found" };
    }

    return { ok: true, report };
  } catch (err) {
    console.error("[getIncidentReport] Error:", err);
    return { ok: false, error: "Failed to fetch incident report" };
  }
}

// Create a new incident report
export async function createIncidentReport(data: {
  title: string;
  description: string;
  incidentDate: Date;
  location: string;
  injuryDetails?: string;
  severity: IncidentSeverity;
  photos?: string[];
  jobId?: string;
  employeesInvolved?: { userId: string; role: EmployeeRole }[];
}) {
  const ctx = await getOrgContext();
  if (!ctx.ok) return ctx;

  // Only admins can create incident reports
  const roleCheck = requireRole(ctx, "ADMIN");
  if (roleCheck) return roleCheck;

  // Must have an organization to create reports
  if (!ctx.organizationId) {
    return { ok: false, error: "No organization found. Cannot create incident report without an organization." };
  }

  try {
    const report = await prisma.incidentReport.create({
      data: {
        title: data.title,
        description: data.description,
        incidentDate: data.incidentDate,
        location: data.location,
        injuryDetails: data.injuryDetails || null,
        severity: data.severity,
        status: "OPEN",
        photos: data.photos || [],
        organizationId: ctx.organizationId,
        createdById: ctx.userId,
        jobId: data.jobId || null,
        employeesInvolved: data.employeesInvolved?.length
          ? {
              create: data.employeesInvolved.map((emp) => ({
                userId: emp.userId,
                role: emp.role,
              })),
            }
          : undefined,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        job: {
          select: { id: true, jobNumber: true, title: true },
        },
        employeesInvolved: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    revalidatePath("/incident-reports");
    return { ok: true, report };
  } catch (err) {
    console.error("[createIncidentReport] Error:", err);
    return { ok: false, error: "Failed to create incident report" };
  }
}

// Update an incident report
export async function updateIncidentReport(
  id: string,
  data: {
    title?: string;
    description?: string;
    incidentDate?: Date;
    location?: string;
    injuryDetails?: string;
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    photos?: string[];
    jobId?: string | null;
    employeesInvolved?: { userId: string; role: EmployeeRole }[];
  }
) {
  const ctx = await getOrgContext();
  if (!ctx.ok) return ctx;

  // Only admins can update incident reports
  const roleCheck = requireRole(ctx, "ADMIN");
  if (roleCheck) return roleCheck;

  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Verify the report belongs to this organization (or Super Admin can access any)
    const where = buildOrgFilter(ctx, { id });
    const existing = await prisma.incidentReport.findFirst({ where });

    if (!existing) {
      return { ok: false, error: "Incident report not found" };
    }

    // If employees are being updated, delete existing and recreate
    if (data.employeesInvolved !== undefined) {
      await prisma.incidentEmployee.deleteMany({
        where: { incidentReportId: id },
      });
    }

    const report = await prisma.incidentReport.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.incidentDate && { incidentDate: data.incidentDate }),
        ...(data.location && { location: data.location }),
        ...(data.injuryDetails !== undefined && { injuryDetails: data.injuryDetails || null }),
        ...(data.status && { status: data.status }),
        ...(data.severity && { severity: data.severity }),
        ...(data.photos && { photos: data.photos }),
        ...(data.jobId !== undefined && { jobId: data.jobId }),
        ...(data.employeesInvolved?.length && {
          employeesInvolved: {
            create: data.employeesInvolved.map((emp) => ({
              userId: emp.userId,
              role: emp.role,
            })),
          },
        }),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        job: {
          select: { id: true, jobNumber: true, title: true },
        },
        employeesInvolved: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    revalidatePath("/incident-reports");
    return { ok: true, report };
  } catch (err) {
    console.error("[updateIncidentReport] Error:", err);
    return { ok: false, error: "Failed to update incident report" };
  }
}

// Delete an incident report
export async function deleteIncidentReport(id: string) {
  const ctx = await getOrgContext();
  if (!ctx.ok) return ctx;

  // Only admins can delete incident reports
  const roleCheck = requireRole(ctx, "ADMIN");
  if (roleCheck) return roleCheck;

  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Verify the report belongs to this organization
    const where = buildOrgFilter(ctx, { id });
    const existing = await prisma.incidentReport.findFirst({ where });

    if (!existing) {
      return { ok: false, error: "Incident report not found" };
    }

    await prisma.incidentReport.delete({
      where: { id },
    });

    revalidatePath("/incident-reports");
    return { ok: true };
  } catch (err) {
    console.error("[deleteIncidentReport] Error:", err);
    return { ok: false, error: "Failed to delete incident report" };
  }
}

// Get jobs for dropdown selection
export async function getJobsForIncident() {
  const ctx = await getOrgContext();
  if (!ctx.ok) return ctx;

  // Only admins can access this
  const roleCheck = requireRole(ctx, "ADMIN");
  if (roleCheck) return roleCheck;

  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Build where clause with org filter
    const where = buildOrgFilter(ctx, {});

    const jobs = await prisma.job.findMany({
      where,
      select: { id: true, jobNumber: true, title: true, status: true },
      orderBy: { createdAt: "desc" },
    });

    return { ok: true, jobs };
  } catch (err) {
    console.error("[getJobsForIncident] Error:", err);
    return { ok: false, error: "Failed to fetch jobs" };
  }
}

// Get employees for selection
export async function getEmployeesForIncident() {
  const ctx = await getOrgContext();
  if (!ctx.ok) {
    console.log("[getEmployeesForIncident] Auth error:", ctx.error);
    return ctx;
  }

  // Only admins can access this
  const roleCheck = requireRole(ctx, "ADMIN");
  if (roleCheck) return roleCheck;

  console.log("[getEmployeesForIncident] organizationId:", ctx.organizationId, "isSuperAdmin:", ctx.isSuperAdmin);
  
  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Build where clause with org filter
    const where = buildOrgFilter(ctx, {});

    // Get all users in the organization (not just APPROVED)
    const employees = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, status: true },
      orderBy: { name: "asc" },
    });

    console.log("[getEmployeesForIncident] Found employees:", employees.length);
    return { ok: true, employees };
  } catch (err) {
    console.error("[getEmployeesForIncident] Error:", err);
    return { ok: false, error: "Failed to fetch employees" };
  }
}
