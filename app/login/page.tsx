"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { broadcastSessionEvent } from "@/lib/session-sync";
import LoginLoadingOverlay from "./LoginLoadingOverlay";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const verified = searchParams?.get("verified");
  const passwordReset = searchParams?.get("passwordReset");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(
    verified === "true" 
      ? "Email verified! You can now sign in." 
      : passwordReset === "true"
      ? "Password reset successfully! You can now sign in with your new password."
      : undefined
  );

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
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-white/20">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">Sign in</h1>
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
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
                
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                
                // For iOS, use NextAuth's built-in redirect which handles cookies better
                if (isIOS) {
                  const res = await signIn("credentials", {
                    email,
                    password,
                    redirect: true,
                    callbackUrl: "/dashboard",
                  });
                  // If redirect is true, signIn will handle the redirect itself
                  // We don't need to do anything else
                  return;
                }
                
                // For non-iOS, use manual redirect with verification
                const res = await signIn("credentials", {
                  email,
                  password,
                  redirect: false,
                });
                
                if (res?.error) {
                  setError(res.error === "CredentialsSignin" ? "Invalid credentials" : res.error);
                  setLoading(false);
                  return;
                }

                // Verify session before proceeding
                let sessionVerified = false;
                for (let attempt = 0; attempt < 3; attempt++) {
                  await new Promise(resolve => setTimeout(resolve, 300));
                  try {
                    const sessionRes = await fetch("/api/auth/session", {
                      credentials: "include",
                      cache: "no-store",
                    });
                    const sessionJson = sessionRes.ok ? await sessionRes.json() : null;
                    if (sessionJson?.user) {
                      sessionVerified = true;
                      break;
                    }
                  } catch (err) {
                    console.log(`[Login] Session check attempt ${attempt + 1} failed:`, err);
                  }
                }

                if (!sessionVerified) {
                  setError("Login failed. Please allow cookies and try again.");
                  setLoading(false);
                  return;
                }
                
                // Broadcast sign in to other tabs
                broadcastSessionEvent("signin");
                
                // Small delay before redirect for other browsers
                await new Promise(resolve => setTimeout(resolve, 500));
                router.replace("/dashboard");
              } catch (err) {
                setError("An error occurred. Please try again.");
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>
            <div>
              <input
                name="password"
                type="password"
                placeholder="Password"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="text-right">
              <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-md min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
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
