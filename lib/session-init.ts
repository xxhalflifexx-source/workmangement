/**
 * Global Session Initialization Utility
 * 
 * This module provides functions to initialize and restore authentication state
 * across page refreshes, new tabs, and browser reopens.
 */

import { getSession } from "next-auth/react";

export interface SessionInitResult {
  isAuthenticated: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
  error: string | null;
}

/**
 * Global function to initialize session on page load
 * Checks for valid token, fetches current user, and restores authentication state
 * 
 * This function:
 * - Checks for valid authentication token (stored in httpOnly cookie)
 * - Fetches current user session
 * - Restores authentication state
 * - Works across page refreshes, new tabs, and browser reopens
 */
export async function initializeSession(): Promise<SessionInitResult> {
  try {
    // NextAuth automatically handles token validation via httpOnly cookies
    // The getSession function will:
    // 1. Check for valid session token in httpOnly cookie
    // 2. Validate token signature and expiration
    // 3. Fetch user data from JWT token
    // 4. Return session if valid, null if invalid/expired
    
    const session = await getSession();

    if (!session || !session.user) {
      return {
        isAuthenticated: false,
        user: null,
        error: null,
      };
    }

    return {
      isAuthenticated: true,
      user: {
        id: (session.user as any).id || "",
        name: session.user.name || null,
        email: session.user.email || null,
        role: (session.user as any).role || "EMPLOYEE",
      },
      error: null,
    };
  } catch (error: any) {
    console.error("[SessionInit] Error initializing session:", error);
    return {
      isAuthenticated: false,
      user: null,
      error: error?.message || "Failed to initialize session",
    };
  }
}

/**
 * Check if user is authenticated (synchronous check)
 * Uses localStorage as a cache indicator (not for security)
 */
export function isAuthenticatedSync(): boolean {
  if (typeof window === "undefined") return false;
  
  // Check if session cookie exists (indicator, not security)
  // Actual validation happens server-side via httpOnly cookie
  try {
    const cookies = document.cookie.split(";");
    const hasSessionCookie = cookies.some((cookie) =>
      cookie.trim().startsWith("next-auth.session-token=")
    );
    return hasSessionCookie;
  } catch {
    return false;
  }
}

/**
 * Get session token from httpOnly cookie (client-side indicator only)
 * Note: Cannot read httpOnly cookies from JavaScript - this is by design for security
 * This function checks for cookie existence as an indicator
 */
export function getSessionTokenIndicator(): string | null {
  if (typeof window === "undefined") return null;
  
  try {
    const cookies = document.cookie.split(";");
    const sessionCookie = cookies.find((cookie) =>
      cookie.trim().startsWith("next-auth.session-token=")
    );
    
    if (sessionCookie) {
      // Token exists (we can't read the value due to httpOnly, but we know it's there)
      return "present";
    }
    
    return null;
  } catch {
    return null;
  }
}

