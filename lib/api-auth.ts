import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";

/**
 * Safely get server session with defensive error handling for iOS Safari
 * Handles cases where cookies might not be set or headers are empty
 */
export async function getSafeServerSession(
  request?: NextRequest
): Promise<Session | null> {
  try {
    // Try to get session from cookies
    const session = await getServerSession(authOptions);
    
    // If session exists and has user, return it
    if (session?.user) {
      return session;
    }
    
    // If no session, check if we can extract from headers (fallback for iOS)
    if (request) {
      const authHeader = request.headers.get("authorization");
      const cookieHeader = request.headers.get("cookie");
      
      // Log for debugging (remove in production if needed)
      if (!cookieHeader) {
        console.log("[API Auth] No cookie header found - possible iOS Safari issue");
      }
      
      // If we have an authorization header, try to use it
      // (This is a fallback - NextAuth primarily uses cookies)
      if (authHeader && authHeader.startsWith("Bearer ")) {
        // Could implement token verification here if needed
        // For now, we rely on NextAuth's cookie-based auth
      }
    }
    
    return null;
  } catch (error) {
    console.error("[API Auth] Error getting session:", error);
    return null;
  }
}

/**
 * Require authentication for API routes with defensive error handling
 * Returns session or throws appropriate error
 */
export async function requireApiAuth(
  request?: NextRequest
): Promise<Session> {
  const session = await getSafeServerSession(request);
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  return session;
}

