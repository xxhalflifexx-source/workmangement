"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { setupSessionSync } from "@/lib/session-sync";
import { useSession } from "next-auth/react";
import SessionInitializer from "@/components/SessionInitializer";

function SessionSyncHandler() {
  const { update } = useSession();

  useEffect(() => {
    // Setup cross-tab session synchronization
    // This does NOT clear sessions - it only syncs state across tabs
    const cleanup = setupSessionSync(
      () => {
        // Another tab signed in - refresh session (does NOT clear)
        update();
      },
      () => {
        // Another tab signed out - refresh session (does NOT clear)
        update();
      },
      () => {
        // Session updated in another tab - refresh (does NOT clear)
        update();
      }
    );

    return cleanup;
  }, [update]);

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



