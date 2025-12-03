"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { UserPermissions, parsePermissions } from "@/lib/permissions";

export async function getUserPermissions(userId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins can view permissions
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can view permissions" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
      },
    });

    if (!user) {
      return { ok: false, error: "User not found" };
    }

    const permissions = parsePermissions(user.permissions);

    return {
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      permissions,
    };
  } catch (error: any) {
    console.error("Error getting user permissions:", error);
    return {
      ok: false,
      error: error?.message || "Failed to get user permissions",
    };
  }
}

export async function getAllUsersWithPermissions() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins can view all users
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can view users" };
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
      },
      orderBy: { name: "asc" },
    });

    const usersWithPermissions = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: parsePermissions(user.permissions),
    }));

    return {
      ok: true,
      users: usersWithPermissions,
    };
  } catch (error: any) {
    console.error("Error getting users with permissions:", error);
    return {
      ok: false,
      error: error?.message || "Failed to get users",
    };
  }
}

export async function updateUserPermissions(
  userId: string,
  permissions: UserPermissions
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins can update permissions
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can update permissions" };
  }

  try {
    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { ok: false, error: "User not found" };
    }

    // Update permissions
    await prisma.user.update({
      where: { id: userId },
      data: {
        permissions: JSON.stringify(permissions),
      },
    });

    return { ok: true };
  } catch (error: any) {
    console.error("Error updating user permissions:", error);
    return {
      ok: false,
      error: error?.message || "Failed to update permissions",
    };
  }
}

export async function getUserPermissionsForSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, permissions: null };
  }

  try {
    const userId = (session.user as any).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { permissions: true, role: true },
    });

    if (!user) {
      return { ok: false, permissions: null };
    }

    const permissions = parsePermissions(user.permissions);

    return {
      ok: true,
      permissions,
      role: user.role,
    };
  } catch (error: any) {
    console.error("Error getting session permissions:", error);
    return { ok: false, permissions: null };
  }
}

