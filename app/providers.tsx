"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { setupSessionSync, getSessionIndicator } from "@/lib/session-sync";
import { useSession } from "next-auth/react";
import SessionInitializer from "@/components/SessionInitializer";

function SessionSyncHandler() {
  const { data: session, update, status } = useSession();

  useEffect(() => {
    // Check if there's a session indicator from another tab
    // This handles the case where user logged in another tab
    const indicator = getSessionIndicator();
    if (indicator && status === "unauthenticated") {
      // Session indicator exists but this tab doesn't have session
      // This means login happened in another tab - restore session
      console.log("[SessionSync] Session indicator found, restoring session...");
      update();
    }

    // Setup cross-tab session synchronization
    // This does NOT clear sessions - it only syncs state across tabs
    const cleanup = setupSessionSync(
      () => {
        // Another tab signed in - restore session in this tab (does NOT clear)
        console.log("[SessionSync] Restoring session from another tab...");
        update().then(() => {
          console.log("[SessionSync] Session restored successfully");
        });
      },
      () => {
        // Another tab signed out - update this tab (does NOT clear, just syncs)
        console.log("[SessionSync] Syncing logout from another tab...");
        update();
      },
      () => {
        // Session updated in another tab - refresh (does NOT clear)
        console.log("[SessionSync] Syncing session update from another tab...");
        update();
      }
    );

    return cleanup;
  }, [update, status]);

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



