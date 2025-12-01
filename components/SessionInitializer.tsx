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
import { setSessionIndicator, getSessionIndicator } from "@/lib/session-sync";

export default function SessionInitializer() {
  const { data: session, status, update } = useSession();

  useEffect(() => {
    // Initialize session on component mount (page load, new tab, browser reopen)
    const initSession = async () => {
      try {
        const result = await initializeSession();
        
        if (result.isAuthenticated && result.user) {
          // Session is valid - store indicator in localStorage for cross-tab sync
          setSessionIndicator(result.user.id, result.user.email || "");
          
          // Ensure it's synced with NextAuth
          if (status === "unauthenticated") {
            // If NextAuth doesn't have session but we detected one, refresh
            update();
          }
          console.log("[SessionInitializer] Session restored:", result.user.email);
        } else {
          // No valid session - check if there's an indicator from another tab
          const indicator = getSessionIndicator();
          if (indicator) {
            // Indicator exists but no session - try to restore
            console.log("[SessionInitializer] Session indicator found, attempting to restore...");
            update();
          } else {
            console.log("[SessionInitializer] No valid session - user needs to log in");
          }
        }
      } catch (error) {
        console.error("[SessionInitializer] Error initializing session:", error);
      }
    };

    // Initialize session
    if (status === "loading" || status === "unauthenticated") {
      initSession();
    } else if (status === "authenticated" && session?.user) {
      // Session is authenticated - ensure indicator is set
      const user = session.user as any;
      if (user.id && user.email) {
        setSessionIndicator(user.id, user.email);
      }
    }
  }, [status, update, session]);

  // This component doesn't render anything
  return null;
}

