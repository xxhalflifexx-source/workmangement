"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Client-side session guard component
 * Prevents premature redirects by checking session client-side
 * Allows time for cookie propagation after login
 */
export default function DashboardSessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    console.log("[DashboardSessionGuard] Client-side session check");
    console.log("[DashboardSessionGuard] Status:", status);
    console.log("[DashboardSessionGuard] Session:", session ? "Found" : "Not found");
    console.log("[DashboardSessionGuard] User email:", session?.user?.email || "None");

    // Wait a bit for session to load
    const checkSession = async () => {
      // Give time for cookie propagation and session to load
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log("[DashboardSessionGuard] After delay - Status:", status);
      console.log("[DashboardSessionGuard] After delay - Session:", session ? "Found" : "Not found");

      if (status === "loading") {
        // Still loading, wait a bit more
        console.log("[DashboardSessionGuard] Session still loading, waiting...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Final check
      if (status === "unauthenticated" || !session?.user) {
        console.log("[DashboardSessionGuard] No session found after delay - redirecting to login");
        if (!redirected) {
          setRedirected(true);
          router.push("/login?callbackUrl=/dashboard");
        }
      } else {
        console.log("[DashboardSessionGuard] Session confirmed, rendering dashboard");
        setChecking(false);
      }
    };

    checkSession();
  }, [status, session, router, redirected]);

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

