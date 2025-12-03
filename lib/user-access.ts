// Server-side permission checking utilities

import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";
import { prisma } from "./prisma";
import { parsePermissions, ModulePermission, hasPermission, MODULE_ROUTES } from "./permissions";

/**
 * Get user permissions from database (server-side)
 */
export async function getUserPermissions(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { permissions: true, role: true },
    });

    if (!user) {
      return null;
    }

    return {
      permissions: parsePermissions(user.permissions),
      role: user.role,
    };
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return null;
  }
}

/**
 * Check if user has access to a module (server-side)
 */
export async function checkModuleAccess(module: ModulePermission): Promise<boolean> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return false;
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  // Admins always have access
  if (userRole === "ADMIN") {
    return true;
  }

  const userPerms = await getUserPermissions(userId);
  if (!userPerms) {
    return false;
  }

  return hasPermission(userPerms.permissions, module);
}

/**
 * Check if user has access to a route (server-side)
 */
export async function checkRouteAccess(pathname: string): Promise<boolean> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return false;
  }

  const userRole = (session.user as any).role;

  // Admins always have access
  if (userRole === "ADMIN") {
    return true;
  }

  // Find which module this route belongs to
  for (const [module, routes] of Object.entries(MODULE_ROUTES)) {
    if (routes.some((route) => pathname.startsWith(route))) {
      return await checkModuleAccess(module as ModulePermission);
    }
  }

  // If route doesn't match any module, allow access (default behavior)
  return true;
}

