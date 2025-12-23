"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

// Helper to get session and check admin role
async function getAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: "Not authenticated", session: null };
  }
  
  const role = (session.user as any).role;
  if (role !== "ADMIN") {
    return { error: "Only admins can manage incident reports", session: null };
  }
  
  return { error: null, session };
}

// Get all incident reports for the organization
export async function getIncidentReports(filters?: {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  jobId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const { error, session } = await getAdminSession();
  if (error || !session) {
    return { ok: false, error: error || "Not authenticated" };
  }

  const organizationId = (session.user as any).organizationId;
  if (!organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    const where: any = { organizationId };
    
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
          select: { id: true, title: true },
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
  const { error, session } = await getAdminSession();
  if (error || !session) {
    return { ok: false, error: error || "Not authenticated" };
  }

  const organizationId = (session.user as any).organizationId;
  if (!organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    const report = await prisma.incidentReport.findFirst({
      where: { id, organizationId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        job: {
          select: { id: true, title: true },
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
  witnesses?: string;
  severity: IncidentSeverity;
  photos?: string[];
  jobId?: string;
  employeesInvolved?: { userId: string; role: EmployeeRole }[];
}) {
  const { error, session } = await getAdminSession();
  if (error || !session) {
    return { ok: false, error: error || "Not authenticated" };
  }

  const organizationId = (session.user as any).organizationId;
  const userId = (session.user as any).id;
  
  if (!organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    const report = await prisma.incidentReport.create({
      data: {
        title: data.title,
        description: data.description,
        incidentDate: data.incidentDate,
        location: data.location,
        injuryDetails: data.injuryDetails || null,
        witnesses: data.witnesses || null,
        severity: data.severity,
        status: "OPEN",
        photos: data.photos || [],
        organizationId,
        createdById: userId,
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
          select: { id: true, title: true },
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
    witnesses?: string;
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    photos?: string[];
    jobId?: string | null;
    employeesInvolved?: { userId: string; role: EmployeeRole }[];
  }
) {
  const { error, session } = await getAdminSession();
  if (error || !session) {
    return { ok: false, error: error || "Not authenticated" };
  }

  const organizationId = (session.user as any).organizationId;
  if (!organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Verify the report belongs to this organization
    const existing = await prisma.incidentReport.findFirst({
      where: { id, organizationId },
    });

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
        ...(data.witnesses !== undefined && { witnesses: data.witnesses || null }),
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
          select: { id: true, title: true },
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
  const { error, session } = await getAdminSession();
  if (error || !session) {
    return { ok: false, error: error || "Not authenticated" };
  }

  const organizationId = (session.user as any).organizationId;
  if (!organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    // Verify the report belongs to this organization
    const existing = await prisma.incidentReport.findFirst({
      where: { id, organizationId },
    });

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
  const { error, session } = await getAdminSession();
  if (error || !session) {
    return { ok: false, error: error || "Not authenticated" };
  }

  const organizationId = (session.user as any).organizationId;
  if (!organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    const jobs = await prisma.job.findMany({
      where: { organizationId },
      select: { id: true, title: true, status: true },
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
  const { error, session } = await getAdminSession();
  if (error || !session) {
    return { ok: false, error: error || "Not authenticated" };
  }

  const organizationId = (session.user as any).organizationId;
  if (!organizationId) {
    return { ok: false, error: "No organization found" };
  }

  try {
    const employees = await prisma.user.findMany({
      where: { organizationId, status: "APPROVED" },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    return { ok: true, employees };
  } catch (err) {
    console.error("[getEmployeesForIncident] Error:", err);
    return { ok: false, error: "Failed to fetch employees" };
  }
}

