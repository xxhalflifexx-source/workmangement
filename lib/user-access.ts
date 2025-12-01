import { prisma } from "./prisma";

/**
 * Check if a user has access to a specific component/page
 * This function checks user-specific overrides first, then falls back to role-based access
 * 
 * @param userId - The user's ID
 * @param userRole - The user's role (ADMIN, MANAGER, EMPLOYEE)
 * @param componentName - The component/page name (e.g., "jobs", "qc", "finance")
 * @returns true if user has access, false otherwise
 */
export async function checkUserAccess(
  userId: string,
  userRole: string,
  componentName: string
): Promise<boolean> {
  // Admins always have access to everything
  if (userRole === "ADMIN") {
    return true;
  }

  // Check for user-specific override
  const override = await prisma.userAccessOverride.findUnique({
    where: {
      userId_componentName: {
        userId,
        componentName,
      },
    },
  });

  // If override exists, use it
  if (override) {
    return override.access === "allowed";
  }

  // Default role-based access (existing system)
  // Managers have access to most things, employees have limited access
  const roleBasedAccess: Record<string, string[]> = {
    jobs: ["ADMIN", "MANAGER", "EMPLOYEE"],
    "time-clock": ["ADMIN", "MANAGER", "EMPLOYEE"],
    qc: ["ADMIN", "MANAGER"],
    finance: ["ADMIN", "MANAGER"],
    hr: ["ADMIN", "MANAGER"],
    inventory: ["ADMIN", "MANAGER"],
    materials: ["ADMIN", "MANAGER", "EMPLOYEE"],
  };

  const allowedRoles = roleBasedAccess[componentName] || [];
  return allowedRoles.includes(userRole);
}

/**
 * Get all components a user has access to
 * Useful for building navigation menus
 */
export async function getUserAccessibleComponents(
  userId: string,
  userRole: string
): Promise<string[]> {
  const allComponents = [
    "jobs",
    "qc",
    "finance",
    "hr",
    "inventory",
    "materials",
    "time-clock",
  ];

  const accessibleComponents: string[] = [];

  for (const component of allComponents) {
    const hasAccess = await checkUserAccess(userId, userRole, component);
    if (hasAccess) {
      accessibleComponents.push(component);
    }
  }

  return accessibleComponents;
}

