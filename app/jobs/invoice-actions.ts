"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function getCompanySettingsForInvoice() {
  try {
    // Get company settings
    let settings = await prisma.companySettings.findFirst();

    // If no settings exist, return defaults
    if (!settings) {
      return {
        companyName: "Your Company Name",
        address: "123 Business Street",
        city: "City",
        state: "State",
        zipCode: "12345",
        phone: "(555) 123-4567",
        email: "billing@company.com",
        website: "www.company.com",
        logoUrl: "",
      };
    }

    return {
      companyName: settings.companyName,
      address: settings.address || "",
      city: settings.city || "",
      state: settings.state || "",
      zipCode: settings.zipCode || "",
      phone: settings.phone || "",
      email: settings.email || "",
      website: settings.website || "",
      logoUrl: settings.logoUrl || "",
    };
  } catch (error) {
    console.error("Get company settings error:", error);
    // Return defaults on error
    return {
      companyName: "Your Company Name",
      address: "123 Business Street",
      city: "City",
      state: "State",
      zipCode: "12345",
      phone: "(555) 123-4567",
      email: "billing@company.com",
      website: "www.company.com",
      logoUrl: "",
    };
  }
}

export async function getJobForInvoice(jobId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        assignee: {
          select: {
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            name: true,
          },
        },
        timeEntries: {
          where: {
            clockOut: { not: null },
          },
          select: {
            clockIn: true,
            clockOut: true,
            user: {
              select: {
                name: true,
                hourlyRate: true,
              },
            },
          },
        },
        materialRequests: {
          where: {
            status: "FULFILLED",
          },
          select: {
            itemName: true,
            quantity: true,
            unit: true,
            fulfilledDate: true,
          },
        },
        expenses: {
          select: {
            category: true,
            description: true,
            amount: true,
            quantity: true,
            unit: true,
            expenseDate: true,
          },
        },
      },
    });

    if (!job) {
      return { ok: false, error: "Job not found" };
    }

    // Check if user is assigned via JobAssignment
    const userAssignment = await prisma.jobAssignment.findFirst({
      where: { jobId: job.id, userId },
    });

    // Check access permissions
    if (
      userRole !== "ADMIN" &&
      userRole !== "MANAGER" &&
      job.assignedTo !== userId &&
      !userAssignment &&
      job.createdBy !== userId
    ) {
      return { ok: false, error: "Access denied" };
    }

    // Calculate total hours and labor costs
    let totalHours = 0;
    let totalLaborCost = 0;
    const laborByUser: Record<string, { name: string; hours: number; rate: number; cost: number }> = {};

    job.timeEntries.forEach((entry) => {
      if (entry.clockIn && entry.clockOut) {
        const duration = new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime();
        const hours = duration / (1000 * 60 * 60);
        const rate = entry.user.hourlyRate || 0;
        const cost = hours * rate;

        totalHours += hours;
        totalLaborCost += cost;

        const userName = entry.user.name || "Unknown";
        if (!laborByUser[userName]) {
          laborByUser[userName] = { name: userName, hours: 0, rate, cost: 0 };
        }
        laborByUser[userName].hours += hours;
        laborByUser[userName].cost += cost;
      }
    });

    // Calculate total expenses
    const totalExpenses = job.expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return { 
      ok: true, 
      job: {
        ...job,
        totalHours: Math.round(totalHours * 100) / 100,
        totalLaborCost: Math.round(totalLaborCost * 100) / 100,
        laborBreakdown: Object.values(laborByUser),
        totalExpenses: Math.round(totalExpenses * 100) / 100,
      }
    };
  } catch (error) {
    console.error("Get job for invoice error:", error);
    return { ok: false, error: "Failed to fetch job data" };
  }
}

