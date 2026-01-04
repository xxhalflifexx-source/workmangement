"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect, useRef } from "react";
import { setupSessionSync } from "@/lib/session-sync";
import { useSession } from "next-auth/react";
import SessionInitializer from "@/components/SessionInitializer";

function SessionSyncHandler() {
  const { update } = useSession();
  // Ref to store update function to avoid dependency issues
  const updateRef = useRef(update);
  updateRef.current = update;

  useEffect(() => {
    // Setup cross-tab session synchronization ONLY
    // Initial session restoration is handled by SessionInitializer
    // This only listens for storage events from other tabs
    const cleanup = setupSessionSync(
      () => {
        // Another tab signed in - restore session in this tab
        console.log("[SessionSync] Restoring session from another tab...");
        updateRef.current().then(() => {
          console.log("[SessionSync] Session restored successfully");
        });
      },
      () => {
        // Another tab signed out - update this tab
        console.log("[SessionSync] Syncing logout from another tab...");
        updateRef.current();
      },
      () => {
        // Session updated in another tab - refresh
        console.log("[SessionSync] Syncing session update from another tab...");
        updateRef.current();
      }
    );

    return cleanup;
  }, []); // Empty deps - only run once on mount to setup listener

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={5 * 60} // Refetch session every 5 minutes (does NOT clear session)
      refetchOnWindowFocus={true} // Refetch when window regains focus (does NOT clear session)
      basePath="/api/auth"
    >
      <SessionSyncHandler />
      <SessionInitializer />
      {children}
    </SessionProvider>
  );
}



