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
                
                // Use redirect: false and handle redirect manually for better iOS compatibility
                const res = await signIn("credentials", {
                  email,
                  password,
                  redirect: false,
                });
                
                if (res?.error) {
                  const errorMsg = res.error === "CredentialsSignin" 
                    ? "Invalid email or password" 
                    : res.error;
                  setError(errorMsg);
                  setLoading(false);
                  return;
                }
                
                // iOS Safari: Verify cookie is set before redirect
                // This prevents redirecting before the token is written to storage
                let cookieVerified = false;
                let sessionVerified = false;
                
                if (isIOS) {
                  // For iOS, retry multiple times with increasing delays
                  // iOS Safari can be slow to write cookies
                  for (let attempt = 0; attempt < 8; attempt++) {
                    const delay = 200 + (attempt * 100); // 200ms, 300ms, 400ms, etc.
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    try {
                      // Check if session cookie exists by checking session endpoint
                      const sessionRes = await fetch("/api/auth/session", {
                        credentials: "include",
                        cache: "no-store",
                        headers: {
                          "Cache-Control": "no-cache",
                        },
                      });
                      
                      if (sessionRes.ok) {
                        const sessionJson = await sessionRes.json();
                        if (sessionJson?.user) {
                          sessionVerified = true;
                          cookieVerified = true;
                          console.log(`[Login] iOS: Session verified on attempt ${attempt + 1}`);
                          break;
                        }
                      }
                    } catch (err) {
                      console.log(`[Login] iOS: Session check attempt ${attempt + 1} failed:`, err);
                    }
                  }
                  
                  if (!cookieVerified) {
                    setError("Login failed. Please enable cookies in Safari Settings > Safari > Privacy & Security, then try again.");
                    setLoading(false);
                    return;
                  }
                } else {
                  // Non-iOS: Quick verification
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  try {
                    const sessionRes = await fetch("/api/auth/session", {
                      credentials: "include",
                      cache: "no-store",
                    });
                    const sessionJson = sessionRes.ok ? await sessionRes.json() : null;
                    if (sessionJson?.user) {
                      sessionVerified = true;
                    }
                  } catch (err) {
                    console.log("[Login] Session check failed:", err);
                  }
                  
                  if (!sessionVerified) {
                    setError("Login failed. Please allow cookies and try again.");
                    setLoading(false);
                    return;
                  }
                }
                
                // Store login indicator in sessionStorage as backup (iOS compatible)
                try {
                  sessionStorage.setItem("auth_login_success", "true");
                  sessionStorage.setItem("auth_timestamp", Date.now().toString());
                } catch (e) {
                  console.log("[Login] Could not write to sessionStorage:", e);
                }
                
                // Broadcast sign in to other tabs
                broadcastSessionEvent("signin");
                
                // Use window.location.href for all devices - most reliable on iOS
                // This ensures a full page reload which properly reads cookies
                window.location.href = "/dashboard";
              } catch (err: any) {
                console.error("[Login] Error:", err);
                setError(err?.message || "An error occurred. Please try again.");
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
