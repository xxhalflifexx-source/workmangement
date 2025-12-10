"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardClient({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      // Wait a bit - sometimes iOS Safari needs time to read cookies
      const timer = setTimeout(() => {
        if (status === "unauthenticated") {
          console.error("[Dashboard] No session found - redirecting to login");
          setShowError(true);
          setTimeout(() => {
            router.replace("/login?error=session");
          }, 2000);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [status, router]);

  if (showError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-4">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Session Expired</h1>
          <p className="text-gray-700 mb-4">
            Your session could not be verified. This may be due to cookie settings on iOS Safari.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; // Will redirect
  }

  return <>{children}</>;
}

