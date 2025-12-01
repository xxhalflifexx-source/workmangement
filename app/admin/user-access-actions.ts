"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// Component names that can be controlled
export const AVAILABLE_COMPONENTS = [
  { name: "jobs", label: "Job Management" },
  { name: "qc", label: "Quality Control" },
  { name: "finance", label: "Finance" },
  { name: "hr", label: "HR" },
  { name: "inventory", label: "Inventory" },
  { name: "materials", label: "Materials Requested" },
  { name: "time-clock", label: "Time Clock" },
] as const;

export async function getUserAccessOverrides() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins can view access overrides
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can view user access settings" };
  }

  try {
    const overrides = await prisma.userAccessOverride.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [
        { user: { name: "asc" } },
        { componentName: "asc" },
      ],
    });

    return { ok: true, overrides };
  } catch (error) {
    console.error("Get user access overrides error:", error);
    return { ok: false, error: "Failed to fetch user access overrides" };
  }
}

export async function getAllUsersWithAccess() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins can view this
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  try {
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
  } catch (error) {
    console.error("Get all users error:", error);
    return { ok: false, error: "Failed to fetch users" };
  }
}

export async function updateUserAccess(
  userId: string,
  componentName: string,
  access: "allowed" | "not_allowed",
  notes?: string
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins can update access
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can update user access" };
  }

  // Validate component name
  const validComponents = AVAILABLE_COMPONENTS.map(c => c.name);
  if (!validComponents.includes(componentName as any)) {
    return { ok: false, error: "Invalid component name" };
  }

  // Validate access value
  if (access !== "allowed" && access !== "not_allowed") {
    return { ok: false, error: "Invalid access value" };
  }

  try {
    const override = await prisma.userAccessOverride.upsert({
      where: {
        userId_componentName: {
          userId,
          componentName,
        },
      },
      update: {
        access,
        notes: notes || null,
      },
      create: {
        userId,
        componentName,
        access,
        notes: notes || null,
      },
    });

    return { ok: true, override };
  } catch (error) {
    console.error("Update user access error:", error);
    return { ok: false, error: "Failed to update user access" };
  }
}

export async function deleteUserAccess(userId: string, componentName: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins can delete access overrides
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    await prisma.userAccessOverride.delete({
      where: {
        userId_componentName: {
          userId,
          componentName,
        },
      },
    });

    return { ok: true };
  } catch (error) {
    console.error("Delete user access error:", error);
    return { ok: false, error: "Failed to delete user access override" };
  }
}

