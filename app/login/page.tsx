"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import LoginLoadingOverlay from "./LoginLoadingOverlay";

export default function LoginPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const verified = searchParams?.get("verified");
  const passwordReset = searchParams?.get("passwordReset");
  const errorParam = searchParams?.get("error");
  const [error, setError] = useState<string | undefined>(
    errorParam ? decodeURIComponent(errorParam) : undefined
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(
    verified === "true" 
      ? "Email verified! You can now sign in." 
      : passwordReset === "true"
      ? "Password reset successfully! You can now sign in with your new password."
      : undefined
  );

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  // Clear error from URL after displaying it
  useEffect(() => {
    if (errorParam && typeof window !== "undefined") {
      // Remove error from URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [errorParam]);

  // Show loading while checking session
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // Don't render login form if already authenticated (redirect will happen)
  if (status === "authenticated" && session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      {/* Login Loading Overlay */}
      <LoginLoadingOverlay show={loading} />
      
      {/* Gradient Fallback Background (base layer) */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600"></div>
      
      {/* Background Image */}
      <img 
        src="/login-background.jpg.jpeg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-[1]"
        onError={(e) => {
          // Hide image if it fails to load, gradient will show
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      
      {/* Low-opacity overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-40 z-[2]"></div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/98 backdrop-blur-md rounded-2xl shadow-xl p-8 sm:p-10 border border-white/30">
          <h1 className="text-3xl font-bold mb-8 text-center text-gray-900">Sign in</h1>
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded text-sm">
              ✅ {success}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              
              // Prevent double submission
              if (loading) return;
              
              setLoading(true);
              setError(undefined);
              
              try {
                const formData = new FormData(e.currentTarget as HTMLFormElement);
                const email = formData.get("email") as string;
                const password = formData.get("password") as string;
                
                console.log("[Login] Attempting sign in for:", email);
                
                // Use redirect: false to handle redirect manually after session is confirmed
                const result = await signIn("credentials", {
                  email,
                  password,
                  redirect: false,
                  callbackUrl: "/dashboard",
                });
                
                console.log("[Login] Sign in result:", result?.ok ? "Success" : "Failed");
                console.log("[Login] Sign in error:", result?.error || "None");
                
                // Check if signIn was successful
                if (result?.error) {
                  // Authentication failed - show error message
                  let errorMessage = result.error;
                  
                  // Map common NextAuth error codes to user-friendly messages
                  if (result.error === "CredentialsSignin") {
                    errorMessage = "Wrong username/password";
                  }
                  
                  console.log("[Login] Authentication failed:", errorMessage);
                  setError(errorMessage);
                  setLoading(false);
                } else if (result?.ok) {
                  // Authentication successful - wait for session to be established
                  console.log("[Login] Authentication successful, establishing session...");
                  
                  // Update session to ensure it's refreshed and cookie is set
                  try {
                    await update();
                    console.log("[Login] Session update called");
                  } catch (updateErr) {
                    console.error("[Login] Session update error:", updateErr);
                    // Continue anyway - cookie might still be set
                  }
                  
                  // Wait for cookie to be set and session to propagate
                  // Give NextAuth time to set the cookie before redirecting
                  await new Promise(resolve => setTimeout(resolve, 300));
                  
                  // Use full page reload to ensure cookie is sent with request
                  // This ensures the browser sends the cookie in the request header
                  console.log("[Login] Redirecting to dashboard with full page reload");
                  window.location.href = "/dashboard";
                } else {
                  // Unexpected result
                  console.error("[Login] Unexpected sign in result:", result);
                  setError("An unexpected error occurred. Please try again.");
                  setLoading(false);
                }
              } catch (err: any) {
                console.error("[Login] Error:", err);
                // Show user-friendly error message
                const errorMessage = err?.message || "Wrong username/password";
                setError(errorMessage);
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <input
                name="email"
                type="email"
                placeholder="Email"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                required
              />
            </div>
            <div>
              <input
                name="password"
                type="password"
                placeholder="Password"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                required
              />
            </div>
            {error && (
              <div className={`px-4 py-3 rounded text-sm ${
                error.includes("pending approval") || error.includes("waiting for approval")
                  ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
                  : error.includes("rejected")
                  ? "bg-red-50 border border-red-200 text-red-800"
                  : error.includes("verify")
                  ? "bg-blue-50 border border-blue-200 text-blue-800"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>
                {error.includes("pending approval") || error.includes("waiting for approval") ? (
                  <div>
                    <strong>⚠️ Account Pending:</strong> {error}
                  </div>
                ) : (
                  <div>
                    <strong>❌ Error:</strong> {error}
                  </div>
                )}
              </div>
            )}
            <div className="text-right">
              <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-sm hover:shadow-md min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <p className="mt-6 text-sm text-center text-gray-600">
            No account?{" "}
            <a className="underline text-blue-600 hover:text-blue-700" href="/register">
              Register
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
