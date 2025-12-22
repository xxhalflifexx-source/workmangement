/**
 * Organization Utilities
 * 
 * Helper functions for multi-tenant organization filtering
 */

import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";
import { prisma } from "./prisma";

export interface OrgContext {
  ok: true;
  userId: string;
  organizationId: string | null;
  isSuperAdmin: boolean;
  role: string;
}

export interface OrgContextError {
  ok: false;
  error: string;
}

export type OrgContextResult = OrgContext | OrgContextError;

/**
 * Get the current user's organization context
 * Returns userId, organizationId, isSuperAdmin, and role
 */
export async function getOrgContext(): Promise<OrgContextResult> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  
  // Fetch fresh data from database to ensure accuracy
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true,
      isSuperAdmin: true,
      role: true,
    },
  });

  if (!user) {
    return { ok: false, error: "User not found" };
  }

  return {
    ok: true,
    userId: user.id,
    organizationId: user.organizationId,
    isSuperAdmin: user.isSuperAdmin,
    role: user.role,
  };
}

/**
 * Build a Prisma where clause that filters by organization
 * Super Admins see all data, regular users only see their org's data
 */
export function buildOrgFilter(ctx: OrgContext, existingWhere: any = {}) {
  // Super Admins see all data
  if (ctx.isSuperAdmin) {
    return existingWhere;
  }

  // Regular users filter by their organization
  return {
    ...existingWhere,
    organizationId: ctx.organizationId,
  };
}

/**
 * Check if user has required role (or higher)
 * Role hierarchy: EMPLOYEE < MANAGER < ADMIN
 * Super Admins always pass role checks
 */
export function hasRole(ctx: OrgContext, requiredRole: "EMPLOYEE" | "MANAGER" | "ADMIN"): boolean {
  if (ctx.isSuperAdmin) return true;
  
  const roleHierarchy = { EMPLOYEE: 1, MANAGER: 2, ADMIN: 3 };
  const userLevel = roleHierarchy[ctx.role as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole];
  
  return userLevel >= requiredLevel;
}

/**
 * Require that user has at least the specified role
 * Returns error result if check fails
 */
export function requireRole(ctx: OrgContext, requiredRole: "EMPLOYEE" | "MANAGER" | "ADMIN"): OrgContextError | null {
  if (!hasRole(ctx, requiredRole)) {
    return { ok: false, error: `Unauthorized: ${requiredRole} or higher role required` };
  }
  return null;
}

/**
 * Get organization ID for creating new records
 * Returns the user's org ID, or null for Super Admins without org
 */
export function getOrgIdForCreate(ctx: OrgContext): string | null {
  return ctx.organizationId;
}

