"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { setupSessionSync } from "@/lib/session-sync";
import { useSession } from "next-auth/react";

function SessionSyncHandler() {
  const { data: session, update } = useSession();

  useEffect(() => {
    const cleanup = setupSessionSync(
      () => {
        // Another tab signed in - refresh session
        update();
      },
      () => {
        // Another tab signed out - refresh session
        update();
      },
      () => {
        // Session updated in another tab
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
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true} // Refetch when window regains focus
    >
      <SessionSyncHandler />
      {children}
    </SessionProvider>
  );
}



