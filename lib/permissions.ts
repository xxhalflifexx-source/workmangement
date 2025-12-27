// Permission types and utilities

export type ModulePermission = 
  | "timeClock"
  | "jobManagement"
  | "qualityControl"
  | "hr"
  | "finance"
  | "inventory"
  | "adminPanel"
  | "operationsCommon"
  | "incidentReports";

export interface UserPermissions {
  timeClock?: boolean;
  jobManagement?: boolean;
  qualityControl?: boolean;
  hr?: boolean;
  finance?: boolean;
  inventory?: boolean;
  adminPanel?: boolean;
  operationsCommon?: boolean;
  incidentReports?: boolean;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  timeClock: true,
  jobManagement: true,
  qualityControl: false,
  hr: false,
  finance: false,
  inventory: false,
  adminPanel: false,
  operationsCommon: true,
  incidentReports: true,
};

export const MODULE_ROUTES: Record<ModulePermission, string[]> = {
  timeClock: ["/time-clock"],
  jobManagement: ["/jobs"],
  qualityControl: ["/qc"],
  hr: ["/hr"],
  finance: ["/finance"],
  inventory: ["/inventory"],
  adminPanel: ["/admin"],
  operationsCommon: ["/operations-common"],
  incidentReports: ["/incident-reports"],
};

/**
 * Parse permissions JSON string to object
 */
export function parsePermissions(permissionsJson: string | null | undefined): UserPermissions {
  if (!permissionsJson || permissionsJson === "{}") {
    return DEFAULT_PERMISSIONS;
  }
  try {
    const parsed = JSON.parse(permissionsJson);
    return { ...DEFAULT_PERMISSIONS, ...parsed };
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

/**
 * Check if user has permission for a module
 */
export function hasPermission(
  permissions: UserPermissions | string | null | undefined,
  module: ModulePermission
): boolean {
  // If permissions is a string, parse it
  const perms = typeof permissions === "string" 
    ? parsePermissions(permissions) 
    : permissions || DEFAULT_PERMISSIONS;

  // Admins always have access to everything
  // This check should be done at the role level, but we'll default to true for admin
  // The actual role check should be done separately

  return perms[module] ?? DEFAULT_PERMISSIONS[module] ?? false;
}

/**
 * Get all module names for display
 */
export function getModuleNames(): Record<ModulePermission, string> {
  return {
    timeClock: "Time Clock",
    jobManagement: "Job Management",
    qualityControl: "Quality Control",
    hr: "HR",
    finance: "Finance",
    inventory: "Inventory",
    adminPanel: "Admin Panel",
    operationsCommon: "Operations Common",
    incidentReports: "Incident Reports",
  };
}

