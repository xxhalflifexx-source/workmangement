"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { z } from "zod";
import { sendJobStatusEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

const jobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum([
    // New lifecycle statuses
    "NOT_STARTED",
    "IN_PROGRESS",
    "AWAITING_QC",
    "REWORK",
    "COMPLETED",
    "CANCELLED",
    // Backwards-compatible legacy value for older jobs
    "PENDING",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  assignedTo: z.string().optional(),
  customerId: z.string().optional(),
  pricingType: z.enum(["FIXED", "T&M"]).optional(),
  estimatedPrice: z.string().optional(),
  finalPrice: z.string().optional(),
  estimatedHours: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function createJob(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  // Only managers and admins can create jobs
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only managers and admins can create jobs" };
  }

  const data = {
    title: formData.get("title"),
    description: formData.get("description") || "",
    status: formData.get("status") || "NOT_STARTED",
    priority: formData.get("priority") || "MEDIUM",
    assignedTo: formData.get("assignedTo") || undefined,
    customerId: formData.get("customerId") || undefined,
    pricingType: formData.get("pricingType") || "FIXED",
    estimatedPrice: formData.get("estimatedPrice") || undefined,
    finalPrice: formData.get("finalPrice") || undefined,
    estimatedHours: formData.get("estimatedHours") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  };

  const parsed = jobSchema.safeParse(data);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const job = await prisma.job.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      assignedTo: parsed.data.assignedTo || null,
      customerId: parsed.data.customerId || null,
      createdBy: userId,
      pricingType: parsed.data.pricingType || "FIXED",
      estimatedPrice: parsed.data.estimatedPrice ? parseFloat(parsed.data.estimatedPrice) : null,
      finalPrice: parsed.data.finalPrice ? parseFloat(parsed.data.finalPrice) : null,
      estimatedHours: parsed.data.estimatedHours ? parseFloat(parsed.data.estimatedHours) : null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
    include: {
      assignee: { select: { name: true, email: true } },
      creator: { select: { name: true } },
      customer: { select: { id: true, name: true, phone: true, email: true, company: true } },
    },
  });

  return { ok: true, job };
}

export async function updateJob(jobId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    return { ok: false, error: "Job not found" };
  }

  // Only creator, assigned user, managers, and admins can update
  if (
    job.createdBy !== userId &&
    job.assignedTo !== userId &&
    userRole !== "MANAGER" &&
    userRole !== "ADMIN"
  ) {
    return { ok: false, error: "Unauthorized" };
  }

  const data = {
    title: formData.get("title"),
    description: formData.get("description") || "",
    status: formData.get("status"),
    priority: formData.get("priority"),
    assignedTo: formData.get("assignedTo") || undefined,
    customerId: formData.get("customerId") || undefined,
    pricingType: formData.get("pricingType") || "FIXED",
    estimatedPrice: formData.get("estimatedPrice") || undefined,
    finalPrice: formData.get("finalPrice") || undefined,
    estimatedHours: formData.get("estimatedHours") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  };

  const parsed = jobSchema.safeParse(data);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      assignedTo: parsed.data.assignedTo || null,
      customerId: parsed.data.customerId || null,
      pricingType: parsed.data.pricingType || "FIXED",
      estimatedPrice: parsed.data.estimatedPrice ? parseFloat(parsed.data.estimatedPrice) : null,
      finalPrice: parsed.data.finalPrice ? parseFloat(parsed.data.finalPrice) : null,
      estimatedHours: parsed.data.estimatedHours ? parseFloat(parsed.data.estimatedHours) : null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
    include: {
      assignee: { select: { name: true, email: true } },
      creator: { select: { name: true } },
      customer: { select: { id: true, name: true, phone: true, email: true, company: true } },
    },
  });

  return { ok: true, job: updated };
}

export async function deleteJob(jobId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    return { ok: false, error: "Job not found" };
  }

  // Only creator, managers, and admins can delete
  if (job.createdBy !== userId && userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  await prisma.job.delete({ where: { id: jobId } });

  return { ok: true };
}

export async function getJobs() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  // Admins and managers see all jobs
  // Employees see only their assigned jobs (assignedTo must equal their userId)
  const whereClause =
    userRole === "ADMIN" || userRole === "MANAGER"
      ? {} // Admins/managers see all jobs
      : { assignedTo: userId }; // Employees only see jobs assigned to them

  const jobs = await prisma.job.findMany({
    where: whereClause,
    include: {
      assignee: { select: { name: true, email: true } },
      creator: { select: { name: true } },
      customer: { select: { id: true, name: true, phone: true, email: true, company: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { ok: true, jobs };
}

/**
 * Lightweight "alerts" feed for the dashboard.
 * For employees: returns their jobs that have important status changes.
 */
export async function getJobAlertsForCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated", jobs: [] as any[] };
  }

  const userId = (session.user as any).id;

  // Jobs where this user is assigned, and status is noteworthy
  const jobs = await prisma.job.findMany({
    where: {
      assignedTo: userId,
      status: {
        in: ["AWAITING_QC", "REWORK", "COMPLETED"],
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      customer: { select: { name: true } },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 5,
  });

  return { ok: true, jobs };
}

export async function getAllUsers() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only managers and admins can see all users
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  return { ok: true, users };
}

/**
 * Mark a job as "Awaiting QC".
 * Only managers/admins can do this. This is an explicit step (no longer tied to clock-out).
 */
export async function markJobAwaitingQC(jobId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only managers and admins can send jobs to QC" };
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      assignee: { select: { email: true, name: true } },
      creator: { select: { email: true, name: true } },
    },
  });

  if (!job) {
    return { ok: false, error: "Job not found" };
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "AWAITING_QC",
    },
  });

  // Notify assignee and creator (if emails exist) – deduplicated by email
  const rawRecipients = [job.assignee?.email, job.creator?.email];
  const recipients = Array.from(
    new Set(rawRecipients.filter((e): e is string => !!e))
  );

  const message = `This job has been marked as Ready for Quality Check.\n\nStatus: AWAITING_QC\nTitle: ${job.title}`;

  await Promise.all(
    recipients.map((email) =>
      sendJobStatusEmail(email, job.title, "AWAITING_QC", message)
    )
  );

  // Refresh job pages
  revalidatePath("/jobs");
  revalidatePath("/dashboard");

  return { ok: true, job: updated };
}

// Job Expenses Actions
export async function getJobExpenses(jobId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const expenses = await prisma.jobExpense.findMany({
      where: { jobId },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { expenseDate: "desc" },
    });

    return { ok: true, expenses };
  } catch (error) {
    console.error("Get job expenses error:", error);
    return { ok: false, error: "Failed to fetch expenses" };
  }
}

export async function addJobExpense(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;

  try {
    const jobId = formData.get("jobId") as string;
    const category = formData.get("category") as string;
    const description = formData.get("description") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const quantity = parseFloat(formData.get("quantity") as string) || 1;
    const unit = formData.get("unit") as string || "";
    const notes = formData.get("notes") as string || "";

    if (!jobId || !category || !description || isNaN(amount)) {
      return { ok: false, error: "Missing required fields" };
    }

    const expense = await prisma.jobExpense.create({
      data: {
        jobId,
        userId,
        category,
        description,
        amount,
        quantity,
        unit: unit || null,
        notes: notes || null,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    return { ok: true, expense };
  } catch (error) {
    console.error("Add job expense error:", error);
    return { ok: false, error: "Failed to add expense" };
  }
}

export async function deleteJobExpense(expenseId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;

  try {
    const expense = await prisma.jobExpense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      return { ok: false, error: "Expense not found" };
    }

    // Only the creator, managers, and admins can delete
    if (
      expense.userId !== userId &&
      userRole !== "MANAGER" &&
      userRole !== "ADMIN"
    ) {
      return { ok: false, error: "Unauthorized" };
    }

    await prisma.jobExpense.delete({ where: { id: expenseId } });

    return { ok: true };
  } catch (error) {
    console.error("Delete job expense error:", error);
    return { ok: false, error: "Failed to delete expense" };
  }
}

export async function calculateJobCosts(jobId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    // Get all time entries for this job with user hourly rates
    const timeEntries = await prisma.timeEntry.findMany({
      where: { jobId, clockOut: { not: null } },
      include: {
        user: { select: { name: true, hourlyRate: true } },
      },
    });

    // Calculate labor costs
    let totalLaborHours = 0;
    let totalLaborCost = 0;
    const laborByUser: Record<string, { name: string; hours: number; rate: number; cost: number }> = {};

    timeEntries.forEach((entry) => {
      if (entry.clockOut) {
        const hours = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / (1000 * 60 * 60);
        const rate = entry.user.hourlyRate || 0;
        const cost = hours * rate;

        totalLaborHours += hours;
        totalLaborCost += cost;

        const userName = entry.user.name || "Unknown";
        if (!laborByUser[entry.userId]) {
          laborByUser[entry.userId] = { name: userName, hours: 0, rate, cost: 0 };
        }
        laborByUser[entry.userId].hours += hours;
        laborByUser[entry.userId].cost += cost;
      }
    });

    // Get all expenses for this job
    const expenses = await prisma.jobExpense.findMany({
      where: { jobId },
    });

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const expensesByCategory: Record<string, number> = {};

    expenses.forEach((exp) => {
      if (!expensesByCategory[exp.category]) {
        expensesByCategory[exp.category] = 0;
      }
      expensesByCategory[exp.category] += exp.amount;
    });

    // Get job pricing
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { pricingType: true, estimatedPrice: true, finalPrice: true },
    });

    return {
      ok: true,
      costs: {
        labor: {
          totalHours: totalLaborHours,
          totalCost: totalLaborCost,
          byUser: Object.values(laborByUser),
        },
        expenses: {
          total: totalExpenses,
          byCategory: expensesByCategory,
          items: expenses,
        },
        totalCost: totalLaborCost + totalExpenses,
        pricing: job,
        profit: job?.finalPrice ? job.finalPrice - (totalLaborCost + totalExpenses) : null,
      },
    };
  } catch (error) {
    console.error("Calculate job costs error:", error);
    return { ok: false, error: "Failed to calculate costs" };
  }
}

export async function getJobTimeEntries(jobId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  try {
    // Check if user has access to this job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { assignedTo: true, createdBy: true },
    });

    if (!job) {
      return { ok: false, error: "Job not found" };
    }

    // Only allow access if user is assigned, creator, or manager/admin
    if (
      userRole !== "ADMIN" &&
      userRole !== "MANAGER" &&
      job.assignedTo !== userId &&
      job.createdBy !== userId
    ) {
      return { ok: false, error: "Access denied" };
    }

    // Fetch time entries for this job with photos
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        jobId,
        images: { not: null }, // Only entries with photos
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        clockIn: "desc",
      },
    });

    return { ok: true, timeEntries };
  } catch (error) {
    console.error("Get job time entries error:", error);
    return { ok: false, error: "Failed to fetch time entries" };
  }
}

export async function getJobActivities(jobId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  try {
    // Check if user has access to this job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { assignedTo: true, createdBy: true },
    });

    if (!job) {
      return { ok: false, error: "Job not found" };
    }

    // Only allow access if user is assigned, creator, or manager/admin
    if (
      userRole !== "ADMIN" &&
      userRole !== "MANAGER" &&
      job.assignedTo !== userId &&
      job.createdBy !== userId
    ) {
      return { ok: false, error: "Access denied" };
    }

    // Fetch all activities for this job
    const activities = await prisma.jobActivity.findMany({
      where: { jobId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { ok: true, activities };
  } catch (error) {
    console.error("Get job activities error:", error);
    return { ok: false, error: "Failed to fetch activities" };
  }
}

export async function addJobActivity(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  const jobId = formData.get("jobId") as string;
  const notes = formData.get("notes") as string;
  const images = formData.get("images") as string;

  if (!jobId) {
    return { ok: false, error: "Job ID is required" };
  }

  if (!notes && !images) {
    return { ok: false, error: "Notes or images are required" };
  }

  try {
    // Check if user has access to this job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { assignedTo: true, createdBy: true },
    });

    if (!job) {
      return { ok: false, error: "Job not found" };
    }

    // Only allow if user is assigned, creator, or manager/admin
    if (
      userRole !== "ADMIN" &&
      userRole !== "MANAGER" &&
      job.assignedTo !== userId &&
      job.createdBy !== userId
    ) {
      return { ok: false, error: "Access denied" };
    }

    // Create activity
    const activity = await prisma.jobActivity.create({
      data: {
        jobId,
        userId,
        type: "UPDATE",
        notes: notes || null,
        images: images || null,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return { ok: true, activity };
  } catch (error) {
    console.error("Add job activity error:", error);
    return { ok: false, error: "Failed to add activity" };
  }
}

// Customer management actions (Manager/Admin only)
export async function getAllCustomers() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only managers and admins can see customers
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
  });

  return { ok: true, customers };
}

export async function createCustomer(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only managers and admins can create customers
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const email = formData.get("email") as string;
  const company = formData.get("company") as string;

  if (!name) {
    return { ok: false, error: "Customer name is required" };
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        company: company || null,
      },
    });

    return { ok: true, customer };
  } catch (error) {
    console.error("Create customer error:", error);
    return { ok: false, error: "Failed to create customer" };
  }
}

