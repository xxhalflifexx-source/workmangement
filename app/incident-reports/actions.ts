"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getOrgContext, buildOrgFilter, requireRole } from "@/lib/org-utils";
import { checkModuleAccess } from "@/lib/user-access";

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

  // Check if user has permission to view incident reports
  const hasAccess = await checkModuleAccess("incidentReports");
  const userRole = ctx.role;
  const canViewAll = userRole === "ADMIN" || userRole === "MANAGER" || hasAccess;

  // Super Admins without org can't create org-specific data
  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Build base where clause with org filter
    let where: any = buildOrgFilter(ctx, {});
    
    // If user doesn't have permission to view all, only show their own reports
    if (!canViewAll) {
      where.createdById = ctx.userId;
    }
    
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

  // Check if user has permission to view incident reports
  const hasAccess = await checkModuleAccess("incidentReports");
  const userRole = ctx.role;
  const canViewAll = userRole === "ADMIN" || userRole === "MANAGER" || hasAccess;

  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Build where clause with org filter
    let where: any = buildOrgFilter(ctx, { id });
    
    // If user doesn't have permission to view all, only allow viewing their own reports
    if (!canViewAll) {
      where.createdById = ctx.userId;
    }

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

  // Check if user has permission to create incident reports
  // All authenticated users can create incident reports by default (safety is important)
  const hasAccess = await checkModuleAccess("incidentReports");
  const userRole = ctx.role;
  
  // Only restrict if explicitly denied (admins/managers always have access)
  if (userRole !== "ADMIN" && userRole !== "MANAGER" && !hasAccess) {
    return { ok: false, error: "You do not have permission to create incident reports" };
  }

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

  // Check permissions
  const hasAccess = await checkModuleAccess("incidentReports");
  const userRole = ctx.role;
  const canManageAll = userRole === "ADMIN" || userRole === "MANAGER" || hasAccess;

  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    return { ok: false, error: "No organization found" };
  }

  // Check if report exists and user has permission
  const existingReport = await prisma.incidentReport.findFirst({
    where: buildOrgFilter(ctx, { id }),
    select: { createdById: true },
  });

  if (!existingReport) {
    return { ok: false, error: "Incident report not found" };
  }

  // Users can only update their own reports unless they have permission to manage all
  if (!canManageAll && existingReport.createdById !== ctx.userId) {
    return { ok: false, error: "You can only update your own incident reports" };
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

  // Check permissions
  const hasAccess = await checkModuleAccess("incidentReports");
  const userRole = ctx.role;
  const canManageAll = userRole === "ADMIN" || userRole === "MANAGER" || hasAccess;

  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Verify the report belongs to this organization
    const where = buildOrgFilter(ctx, { id });
    const existing = await prisma.incidentReport.findFirst({
      where,
      select: { createdById: true },
    });

    if (!existing) {
      return { ok: false, error: "Incident report not found" };
    }

    // Users can only delete their own reports unless they have permission to manage all
    if (!canManageAll && existing.createdById !== ctx.userId) {
      return { ok: false, error: "You can only delete your own incident reports" };
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

  // Check permissions - users with incidentReports permission can access
  const hasAccess = await checkModuleAccess("incidentReports");
  const userRole = ctx.role;
  
  if (userRole !== "ADMIN" && userRole !== "MANAGER" && !hasAccess) {
    return { ok: false, error: "You do not have permission to access this" };
  }

  try {
    // Build where clause that includes both org jobs and legacy jobs (organizationId = null)
    // This ensures backward compatibility with old jobs created before org assignment
    let where: any = {};
    
    if (ctx.isSuperAdmin) {
      // Super admins can see all jobs
      where = {};
    } else if (ctx.organizationId) {
      // Regular users: show jobs from their org OR legacy jobs (null orgId)
      where = {
        OR: [
          { organizationId: ctx.organizationId },
          { organizationId: null }, // Include legacy jobs created before org assignment
        ],
      };
    } else {
      // User has no organization - only show legacy jobs
      where = { organizationId: null };
    }

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

// Get days since last accident
export async function getDaysSinceLastAccident() {
  console.log("[getDaysSinceLastAccident] Starting...");
  
  const ctx = await getOrgContext();
  console.log("[getDaysSinceLastAccident] Context:", ctx.ok ? `authenticated, org: ${(ctx as any).organizationId}, role: ${(ctx as any).role}` : (ctx as any).error);
  
  if (!ctx.ok) return { ok: false, error: ctx.error };

  if (!ctx.isSuperAdmin && !ctx.organizationId) {
    console.log("[getDaysSinceLastAccident] No organization found for user");
    return { ok: false, error: "No organization found" };
  }

  try {
    // Build where clause with org filter
    const where = buildOrgFilter(ctx, {});
    console.log("[getDaysSinceLastAccident] Query where:", JSON.stringify(where));

    // Get the most recent incident report by incidentDate
    const lastReport = await prisma.incidentReport.findFirst({
      where,
      select: { incidentDate: true },
      orderBy: { incidentDate: "desc" },
    });

    console.log("[getDaysSinceLastAccident] Last report found:", lastReport ? lastReport.incidentDate : "none");

    if (!lastReport) {
      // No incidents yet
      console.log("[getDaysSinceLastAccident] No incidents found, returning null");
      return { ok: true, days: null, hasIncidents: false };
    }

    // Calculate days since last accident
    const lastDate = new Date(lastReport.incidentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    console.log("[getDaysSinceLastAccident] Days since last accident:", diffDays);
    return { ok: true, days: diffDays, hasIncidents: true, lastIncidentDate: lastDate };
  } catch (err) {
    console.error("[getDaysSinceLastAccident] Error:", err);
    return { ok: false, error: "Failed to calculate days since last accident" };
  }
}

// Get employees for selection
export async function getEmployeesForIncident() {
  const ctx = await getOrgContext();
  if (!ctx.ok) {
    console.log("[getEmployeesForIncident] Auth error:", ctx.error);
    return ctx;
  }

  // Check permissions - users with incidentReports permission can access
  const hasAccess = await checkModuleAccess("incidentReports");
  const userRole = ctx.role;
  
  if (userRole !== "ADMIN" && userRole !== "MANAGER" && !hasAccess) {
    return { ok: false, error: "You do not have permission to access this" };
  }

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
