"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

/**
 * Client-side session guard component
 * Prevents premature redirects by checking session client-side
 * Allows time for cookie propagation after login
 */
export default function DashboardSessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const hasChecked = useRef(false);
  const isRedirecting = useRef(false);

  useEffect(() => {
    // Prevent multiple runs
    if (hasChecked.current || isRedirecting.current) {
      return;
    }

    // Only proceed when status is not loading
    if (status === "loading") {
      return;
    }

    console.log("[DashboardSessionGuard] Client-side session check");
    console.log("[DashboardSessionGuard] Status:", status);
    console.log("[DashboardSessionGuard] Session:", session ? "Found" : "Not found");

    // Mark as checked to prevent loops
    hasChecked.current = true;

    if (status === "authenticated" && session?.user) {
      console.log("[DashboardSessionGuard] Session confirmed, rendering dashboard");
      setChecking(false);
    } else if (status === "unauthenticated") {
      console.log("[DashboardSessionGuard] No session found - redirecting to login");
      isRedirecting.current = true;
      router.push("/login?callbackUrl=/dashboard");
    }
  }, [status]); // Only depend on status, not the full session object

  // Show loading while checking
  if (checking || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking session...</p>
        </div>
      </div>
    );
  }

  // If authenticated, render children
  if (status === "authenticated" && session?.user) {
    return <>{children}</>;
  }

  // If not authenticated, show redirect message
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  );
}

