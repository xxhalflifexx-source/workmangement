"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Client-side session guard component (fallback only)
 * Used only when server-side session check fails
 * Renders children immediately while checking - no spinner loop
 */
export default function DashboardSessionGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect once, and only if definitely unauthenticated
    if (status === "unauthenticated" && !hasRedirected.current) {
      console.log("[DashboardSessionGuard] Unauthenticated - redirecting to login");
      hasRedirected.current = true;
      router.replace("/login?callbackUrl=/dashboard");
    }
  }, [status, router]);

  // Always render children - don't show spinner
  // If unauthenticated, user will be redirected via the effect above
  // This prevents the infinite loop of "checking session" spinner
  return <>{children}</>;
}

