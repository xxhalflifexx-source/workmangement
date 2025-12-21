"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isCapacitor, setIsCapacitor] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if we're in Capacitor
    setIsCapacitor(!!(window as any).Capacitor);
    
    // Only auto-redirect if NOT in Capacitor (web browser)
    // In Capacitor, let user manually navigate to avoid white screen issues
    if (!(window as any).Capacitor && status === "authenticated" && session?.user) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  // Show loading while checking session
  if (!mounted || status === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  // In Capacitor, always show welcome/login (don't auto-redirect)
  // This prevents white screen if dashboard fails to load
  if (isCapacitor) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center space-y-6 bg-white rounded-xl shadow-lg p-8 max-w-md">
          <h1 className="text-4xl font-bold text-gray-900">Work Management</h1>
          <p className="text-gray-600">Sign in to continue</p>
          <div className="flex flex-col gap-3">
            <Link 
              href="/login" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Sign In
            </Link>
            {session?.user && (
              <Link 
                href="/dashboard" 
                className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Web browser: redirect if logged in, otherwise show welcome
  if (status === "authenticated" && session?.user) {
    return null; // Will redirect via useEffect
  }

  // Not logged in - show welcome page
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Welcome to NextAuth Demo</h1>
        <p className="text-gray-600">Authentication with role-based access control</p>
        <div className="flex gap-4 justify-center">
          <Link href="/login" className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50">
            Login
          </Link>
          <Link href="/register" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}



