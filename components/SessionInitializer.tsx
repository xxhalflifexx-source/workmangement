"use client";

/**
 * SessionInitializer Component
 * 
 * This component ensures session is initialized on every page load.
 * It runs once when the component mounts and handles:
 * - Page refresh
 * - New browser tab
 * - Browser reopen (if allowed by system settings)
 * 
 * It does NOT clear sessions or cause auto-logout.
 */
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { initializeSession } from "@/lib/session-init";

export default function SessionInitializer() {
  const { data: session, status, update } = useSession();

  useEffect(() => {
    // Initialize session on component mount (page load, new tab, browser reopen)
    const initSession = async () => {
      try {
        const result = await initializeSession();
        
        if (result.isAuthenticated && result.user) {
          // Session is valid - ensure it's synced with NextAuth
          if (status === "unauthenticated") {
            // If NextAuth doesn't have session but we detected one, refresh
            update();
          }
          console.log("[SessionInitializer] Session restored:", result.user.email);
        } else {
          // No valid session - user needs to log in
          console.log("[SessionInitializer] No valid session - user needs to log in");
        }
      } catch (error) {
        console.error("[SessionInitializer] Error initializing session:", error);
      }
    };

    // Only initialize if session status is loading or unauthenticated
    // If already authenticated, NextAuth is handling it
    if (status === "loading" || status === "unauthenticated") {
      initSession();
    }
  }, [status, update]);

  // This component doesn't render anything
  return null;
}

