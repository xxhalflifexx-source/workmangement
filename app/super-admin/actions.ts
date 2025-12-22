"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { z } from "zod";
import { hash } from "bcryptjs";

// Helper function to check if user is Super Admin
async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  
  // Check database for isSuperAdmin flag (more reliable than session)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });

  if (!user?.isSuperAdmin) {
    return { ok: false, error: "Unauthorized: Super Admin access required" };
  }

  return { ok: true, userId };
}

// ============ Organization Management ============

const createOrgSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export async function getAllOrganizations() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  try {
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            jobs: true,
            customers: true,
            invoices: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { ok: true, organizations };
  } catch (error) {
    console.error("Get organizations error:", error);
    return { ok: false, error: "Failed to fetch organizations" };
  }
}

export async function getOrganizationById(orgId: string) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            users: true,
            jobs: true,
            customers: true,
            invoices: true,
            quotations: true,
            inventoryItems: true,
          },
        },
        companySettings: true,
      },
    });

    if (!organization) {
      return { ok: false, error: "Organization not found" };
    }

    return { ok: true, organization };
  } catch (error) {
    console.error("Get organization error:", error);
    return { ok: false, error: "Failed to fetch organization" };
  }
}

export async function createOrganization(formData: FormData) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  const data = {
    name: formData.get("name") as string,
    slug: (formData.get("slug") as string)?.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
  };

  const parsed = createOrgSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    // Check if slug is unique
    const existing = await prisma.organization.findUnique({
      where: { slug: parsed.data.slug },
    });

    if (existing) {
      return { ok: false, error: "An organization with this slug already exists" };
    }

    const organization = await prisma.organization.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        isActive: true,
      },
    });

    return { ok: true, organization, message: "Organization created successfully" };
  } catch (error) {
    console.error("Create organization error:", error);
    return { ok: false, error: "Failed to create organization" };
  }
}

export async function updateOrganization(orgId: string, formData: FormData) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  const data = {
    name: formData.get("name") as string,
    slug: (formData.get("slug") as string)?.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
  };

  const parsed = createOrgSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    // Check if slug is unique (excluding current org)
    const existing = await prisma.organization.findFirst({
      where: {
        slug: parsed.data.slug,
        NOT: { id: orgId },
      },
    });

    if (existing) {
      return { ok: false, error: "An organization with this slug already exists" };
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
      },
    });

    return { ok: true, message: "Organization updated successfully" };
  } catch (error) {
    console.error("Update organization error:", error);
    return { ok: false, error: "Failed to update organization" };
  }
}

export async function toggleOrganizationStatus(orgId: string) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { isActive: true, name: true },
    });

    if (!org) {
      return { ok: false, error: "Organization not found" };
    }

    const newStatus = !org.isActive;

    await prisma.organization.update({
      where: { id: orgId },
      data: { isActive: newStatus },
    });

    return {
      ok: true,
      message: `Organization "${org.name}" has been ${newStatus ? "enabled" : "disabled"}`,
      isActive: newStatus,
    };
  } catch (error) {
    console.error("Toggle organization status error:", error);
    return { ok: false, error: "Failed to update organization status" };
  }
}

export async function deleteOrganization(orgId: string) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            users: true,
            jobs: true,
          },
        },
      },
    });

    if (!org) {
      return { ok: false, error: "Organization not found" };
    }

    // Warn if organization has data
    if (org._count.users > 0 || org._count.jobs > 0) {
      return {
        ok: false,
        error: `Cannot delete organization with ${org._count.users} users and ${org._count.jobs} jobs. Disable it instead, or delete all data first.`,
      };
    }

    await prisma.organization.delete({
      where: { id: orgId },
    });

    return { ok: true, message: `Organization "${org.name}" has been deleted` };
  } catch (error) {
    console.error("Delete organization error:", error);
    return { ok: false, error: "Failed to delete organization" };
  }
}

// ============ User Management Across Organizations ============

export async function getOrganizationUsers(orgId: string) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  try {
    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isVerified: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        createdAt: true,
        _count: {
          select: {
            timeEntries: true,
            assignedJobs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { ok: true, users };
  } catch (error) {
    console.error("Get organization users error:", error);
    return { ok: false, error: "Failed to fetch users" };
  }
}

export async function getAllUsersAcrossOrganizations() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isVerified: true,
        isSuperAdmin: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        createdAt: true,
        _count: {
          select: {
            timeEntries: true,
            assignedJobs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { ok: true, users };
  } catch (error) {
    console.error("Get all users error:", error);
    return { ok: false, error: "Failed to fetch users" };
  }
}

export async function assignUserToOrganization(userId: string, organizationId: string | null) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isSuperAdmin: true },
    });

    if (!user) {
      return { ok: false, error: "User not found" };
    }

    // Super Admins shouldn't be assigned to organizations
    if (user.isSuperAdmin) {
      return { ok: false, error: "Super Admins cannot be assigned to organizations" };
    }

    // Verify organization exists if provided
    if (organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });

      if (!org) {
        return { ok: false, error: "Organization not found" };
      }

      await prisma.user.update({
        where: { id: userId },
        data: { organizationId },
      });

      return { ok: true, message: `User assigned to "${org.name}"` };
    } else {
      // Remove from organization
      await prisma.user.update({
        where: { id: userId },
        data: { organizationId: null },
      });

      return { ok: true, message: "User removed from organization" };
    }
  } catch (error) {
    console.error("Assign user to organization error:", error);
    return { ok: false, error: "Failed to assign user to organization" };
  }
}

export async function toggleUserStatus(userId: string) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, email: true, isSuperAdmin: true },
    });

    if (!user) {
      return { ok: false, error: "User not found" };
    }

    if (user.isSuperAdmin) {
      return { ok: false, error: "Cannot disable Super Admin accounts" };
    }

    const newStatus = user.status === "APPROVED" ? "REJECTED" : "APPROVED";

    await prisma.user.update({
      where: { id: userId },
      data: { status: newStatus },
    });

    return {
      ok: true,
      message: `User ${user.email} has been ${newStatus === "APPROVED" ? "enabled" : "disabled"}`,
      status: newStatus,
    };
  } catch (error) {
    console.error("Toggle user status error:", error);
    return { ok: false, error: "Failed to update user status" };
  }
}

export async function deleteUserAsSuper(userId: string) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isSuperAdmin: true },
    });

    if (!user) {
      return { ok: false, error: "User not found" };
    }

    if (user.isSuperAdmin) {
      return { ok: false, error: "Cannot delete Super Admin accounts" };
    }

    if (userId === auth.userId) {
      return { ok: false, error: "Cannot delete your own account" };
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return { ok: true, message: `User ${user.email} has been deleted` };
  } catch (error) {
    console.error("Delete user error:", error);
    return { ok: false, error: "Failed to delete user" };
  }
}

// ============ Create Admin for Organization ============

const createOrgAdminSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  organizationId: z.string().min(1, "Organization is required"),
});

export async function createOrganizationAdmin(formData: FormData) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  const data = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    organizationId: formData.get("organizationId") as string,
  };

  const parsed = createOrgAdminSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    // Check if email is unique
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existing) {
      return { ok: false, error: "A user with this email already exists" };
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: parsed.data.organizationId },
      select: { name: true },
    });

    if (!org) {
      return { ok: false, error: "Organization not found" };
    }

    const passwordHash = await hash(parsed.data.password, 10);

    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: "ADMIN",
        status: "APPROVED",
        isVerified: true,
        organizationId: parsed.data.organizationId,
      },
    });

    return {
      ok: true,
      message: `Admin account created for "${org.name}"`,
    };
  } catch (error) {
    console.error("Create organization admin error:", error);
    return { ok: false, error: "Failed to create admin account" };
  }
}

// ============ Dashboard Stats ============

export async function getSuperAdminDashboardStats() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  try {
    const [
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      totalJobs,
      totalInvoices,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isSuperAdmin: false } }),
      prisma.job.count(),
      prisma.invoice.count(),
    ]);

    // Get organizations with most users
    const topOrganizations = await prisma.organization.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        _count: {
          select: {
            users: true,
            jobs: true,
          },
        },
      },
      orderBy: {
        users: {
          _count: "desc",
        },
      },
    });

    return {
      ok: true,
      stats: {
        totalOrganizations,
        activeOrganizations,
        disabledOrganizations: totalOrganizations - activeOrganizations,
        totalUsers,
        totalJobs,
        totalInvoices,
        topOrganizations,
      },
    };
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return { ok: false, error: "Failed to fetch dashboard statistics" };
  }
}

