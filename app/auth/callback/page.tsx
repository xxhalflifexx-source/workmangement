"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user) {
      // Session is confirmed, redirect to dashboard
      console.log("[Auth Callback] Session confirmed, redirecting to dashboard");
      router.replace("/dashboard");
    } else if (status === "unauthenticated") {
      // No session after login - likely cookie issue
      console.error("[Auth Callback] No session found after login");
      setError("Login failed. Please enable cookies in your browser settings and try again.");
      
      // Redirect back to login after showing error
      setTimeout(() => {
        router.replace("/login?error=cookie");
      }, 3000);
    }
  }, [status, session, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-4">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Login Failed</h1>
          <p className="text-gray-700 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-4">
            For iOS Safari: Go to Settings → Safari → Privacy & Security → 
            Turn off "Prevent Cross-Site Tracking" and "Block All Cookies"
          </p>
          <button
            onClick={() => router.replace("/login")}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing login...</p>
      </div>
    </div>
  );
}

