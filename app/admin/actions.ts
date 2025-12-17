"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { z } from "zod";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { parseCentralDate, parseDateOnly, nowInCentral } from "@/lib/date-utils";

// Set timezone for Node.js process
if (typeof process !== "undefined") {
  process.env.TZ = "America/Chicago";
}

const companySettingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
});

export async function getAllUsersForAdmin() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Admins and managers can access user management
  if (userRole !== "ADMIN" && userRole !== "MANAGER") {
    return { ok: false, error: "Unauthorized: Only admins and managers can manage users" };
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        gender: true,
        birthDate: true,
        status: true,
        hourlyRate: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            timeEntries: true,
            assignedJobs: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { ok: true, users };
  } catch (error) {
    console.error("Get users error:", error);
    return { ok: false, error: "Failed to fetch users" };
  }
}

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN"]).default("EMPLOYEE"),
  gender: z.string().optional(),
  birthDate: z.string().optional(), // ISO date string
});

export async function createUserByAdmin(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can create users" };
  }

  const data = {
    name: (formData.get("name") as string) || "",
    email: (formData.get("email") as string) || "",
    password: (formData.get("password") as string) || "",
    role: (formData.get("role") as string) || "EMPLOYEE",
    gender: (formData.get("gender") as string) || undefined,
    birthDate: (formData.get("birthDate") as string) || undefined,
  };

  const parsed = createUserSchema.safeParse(data);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existing) {
      return { ok: false, error: "A user with this email already exists" };
    }

    const passwordHash = await hash(parsed.data.password, 10);

    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
        gender: parsed.data.gender || null,
        birthDate: parsed.data.birthDate ? parseDateOnly(parsed.data.birthDate) : null,
        isVerified: true,
      },
    });

    return { ok: true, message: "User account created successfully" };
  } catch (error) {
    console.error("Create user by admin error:", error);
    return { ok: false, error: "Failed to create user" };
  }
}

export async function resetUserPasswordByAdmin(userId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  if (userRole !== "ADMIN" && userRole !== "MANAGER") {
    return { ok: false, error: "Unauthorized: Only admins and managers can reset passwords" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user || !user.email) {
      return { ok: false, error: "User not found or missing email" };
    }

    // Generate a 10-character temporary password (letters + numbers)
    const tempPassword = randomBytes(6).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
    const passwordHash = await hash(tempPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        isVerified: true,
      },
    });

    return {
      ok: true,
      message: "Temporary password generated successfully",
      tempPassword,
      email: user.email,
    };
  } catch (error) {
    console.error("Reset user password by admin error:", error);
    return { ok: false, error: "Failed to reset user password" };
  }
}

export async function deleteUser(userId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  const currentUserId = (session.user as any).id;

  // Only admins can delete users
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can delete users" };
  }

  // Prevent self-deletion
  if (userId === currentUserId) {
    return { ok: false, error: "You cannot delete your own account" };
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      return { ok: false, error: "User not found" };
    }

    // Delete the user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    return { ok: true, message: `User ${user.name || user.email} deleted successfully` };
  } catch (error) {
    console.error("Delete user error:", error);
    return { ok: false, error: "Failed to delete user. They may have related records." };
  }
}

export async function updateUserHourlyRate(userId: string, hourlyRate: number) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins can update hourly rates
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can update hourly rates" };
  }

  if (hourlyRate < 0) {
    return { ok: false, error: "Hourly rate must be positive" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { hourlyRate: hourlyRate > 0 ? hourlyRate : null },
    });

    return { ok: true, message: "Hourly rate updated successfully" };
  } catch (error) {
    console.error("Update hourly rate error:", error);
    return { ok: false, error: "Failed to update hourly rate" };
  }
}

export async function updateUserProfileDetails(
  userId: string,
  gender?: string | null,
  birthDate?: string | null,
  status?: string | null
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Admins and managers can update profile details (status, gender, birth date)
  if (userRole !== "ADMIN" && userRole !== "MANAGER") {
    return { ok: false, error: "Unauthorized: Only admins and managers can update user details" };
  }

  const data: any = {};
  if (typeof gender !== "undefined") {
    data.gender = gender && gender.trim().length > 0 ? gender : null;
  }
  if (typeof birthDate !== "undefined") {
    data.birthDate = birthDate ? parseDateOnly(birthDate) : null;
  }
  if (typeof status !== "undefined") {
    data.status = status || null;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No changes to apply" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data,
    });

    return { ok: true, message: "User details updated successfully" };
  } catch (error) {
    console.error("Update user profile details error:", error);
    return { ok: false, error: "Failed to update user details" };
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins and managers can change roles (including their own)
  if (userRole !== "ADMIN" && userRole !== "MANAGER") {
    return { ok: false, error: "Unauthorized: Only admins and managers can change user roles" };
  }

  // Validate role
  if (!["EMPLOYEE", "MANAGER", "ADMIN"].includes(newRole)) {
    return { ok: false, error: "Invalid role" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    return { ok: true, message: "User role updated successfully" };
  } catch (error) {
    console.error("Update role error:", error);
    return { ok: false, error: "Failed to update user role" };
  }
}

export async function getCompanySettings() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can view settings" };
  }

  try {
    // Try to get company settings
    const settings = await prisma.companySettings.findFirst().catch(() => null);

    // If no settings exist or table doesn't exist, return defaults
    if (!settings) {
      return {
        ok: true,
        settings: {
          companyName: "Your Company Name",
          address: "123 Business Street",
          city: "City",
          state: "State",
          zipCode: "12345",
          phone: "(555) 123-4567",
          email: "billing@company.com",
          website: "www.company.com",
          logoUrl: "",
        },
      };
    }

    return {
      ok: true,
      settings: {
        companyName: settings.companyName,
        address: settings.address || "",
        city: settings.city || "",
        state: settings.state || "",
        zipCode: settings.zipCode || "",
        phone: settings.phone || "",
        email: settings.email || "",
        website: settings.website || "",
        logoUrl: settings.logoUrl || "",
      },
    };
  } catch (error) {
    console.error("Get company settings error:", error);
    // Return defaults on any error
    return {
      ok: true,
      settings: {
        companyName: "Your Company Name",
        address: "123 Business Street",
        city: "City",
        state: "State",
        zipCode: "12345",
        phone: "(555) 123-4567",
        email: "billing@company.com",
        website: "www.company.com",
        logoUrl: "",
      },
    };
  }
}

export async function updateCompanySettings(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can update settings" };
  }

  const data = {
    companyName: formData.get("companyName"),
    address: formData.get("address"),
    city: formData.get("city"),
    state: formData.get("state"),
    zipCode: formData.get("zipCode"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    website: formData.get("website"),
    logoUrl: formData.get("logoUrl"),
  };

  const parsed = companySettingsSchema.safeParse(data);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    // Try to get existing settings
    const existing = await prisma.companySettings.findFirst().catch(() => null);

    if (existing) {
      // Update existing record
      await prisma.companySettings.update({
        where: { id: existing.id },
        data: {
          companyName: parsed.data.companyName,
          address: parsed.data.address || null,
          city: parsed.data.city || null,
          state: parsed.data.state || null,
          zipCode: parsed.data.zipCode || null,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          website: parsed.data.website || null,
          logoUrl: parsed.data.logoUrl || null,
        },
      });
    } else {
      // Create new record
      await prisma.companySettings.create({
        data: {
          companyName: parsed.data.companyName,
          address: parsed.data.address || null,
          city: parsed.data.city || null,
          state: parsed.data.state || null,
          zipCode: parsed.data.zipCode || null,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          website: parsed.data.website || null,
          logoUrl: parsed.data.logoUrl || null,
        },
      });
    }
    
    return { ok: true, message: "Company settings updated successfully" };
  } catch (error) {
    console.error("Update settings error:", error);
    return { ok: false, error: "Database table not ready. Please run: npx prisma db push" };
  }
}

export async function getFinancialSummary(startDate?: string, endDate?: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Allow managers and admins to view financials
  if (userRole !== "ADMIN" && userRole !== "MANAGER") {
    return { ok: false, error: "Unauthorized: Only managers and admins can view financials" };
  }

  // Date range
  const start = startDate ? parseCentralDate(startDate) : nowInCentral().startOf('year').toDate();
  const end = endDate ? parseCentralDate(endDate) : nowInCentral().endOf('day').toDate();

  try {
    // Revenue = sum of job.finalPrice within range OR estimatedPrice when final missing and job completed
    const jobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        status: true,
        finalPrice: true,
        estimatedPrice: true,
      },
    });

    const revenue = jobs.reduce(
      (sum: number, j: { status: string; finalPrice: number | null; estimatedPrice: number | null }) => {
      if (j.finalPrice) return sum + j.finalPrice;
      if (j.status === "COMPLETED" && j.estimatedPrice) return sum + j.estimatedPrice;
      return sum;
    }, 0);

    // Labor costs from time entries (clockOut within range) * user.hourlyRate
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        clockOut: { not: null, gte: start, lte: end },
      },
      include: { user: { select: { hourlyRate: true } } },
    });

    let laborHours = 0;
    let laborCost = 0;
    for (const te of timeEntries) {
      if (!te.clockOut) continue;
      const hours = (te.clockOut.getTime() - te.clockIn.getTime()) / (1000 * 60 * 60);
      const rate = te.user.hourlyRate || 0;
      laborHours += hours;
      laborCost += hours * rate;
    }

    // Expenses from JobExpense within range
    const expenses = await prisma.jobExpense.findMany({
      where: { expenseDate: { gte: start, lte: end } },
      select: { amount: true, category: true },
    });

    const totalExpenses = expenses.reduce(
      (sum: number, e: { amount: number; category: string }) => sum + e.amount,
      0
    );
    const expensesByCategory: Record<string, number> = {};
    for (const e of expenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
    }

    const profit = revenue - (laborCost + totalExpenses);

    return {
      ok: true,
      summary: {
        period: { start: start.toISOString(), end: end.toISOString() },
        revenue,
        labor: { hours: laborHours, cost: laborCost },
        expenses: { total: totalExpenses, byCategory: expensesByCategory },
        profit,
        bankroll: profit, // baseline bankroll; could be extended with opening balance later
      },
    };
  } catch (error) {
    console.error("Financial summary error:", error);
    return { ok: false, error: "Failed to compute financial summary" };
  }
}

export async function listActiveInvoices() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

  const invoices = await prisma.invoice.findMany({
    where: { NOT: { status: { in: ["PAID", "VOID"] } } },
    include: { customer: true, job: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
  return { ok: true, invoices };
}

export async function listOpenEstimates() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { finalPrice: null, estimatedPrice: { not: null } },
        { finalPrice: null, pricingType: "T&M" },
      ],
    },
    select: { id: true, title: true, customer: { select: { name: true } }, estimatedPrice: true, pricingType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { ok: true, estimates: jobs };
}

