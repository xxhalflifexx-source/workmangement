"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "../(auth)/actions";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoadingParams, setIsLoadingParams] = useState(true);

  useEffect(() => {
    // Get parameters from URL
    const tokenParam = searchParams.get("token");
    const emailParam = searchParams.get("email");
    
    setIsLoadingParams(false);
    
    if (!tokenParam || !emailParam) {
      setError("Invalid reset link. Please request a new password reset.");
    } else {
      setToken(tokenParam);
      setEmail(emailParam);
    }
  }, [searchParams]);

  // Show loading state while reading URL parameters
  if (isLoadingParams) {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
        <p className="text-gray-600 text-sm">Loading...</p>
      </main>
    );
  }

  // Show error if token or email is missing
  if (!token || !email) {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="text-2xl font-bold mb-4">Invalid Reset Link</h1>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            ❌ {error}
          </div>
        )}
        <p className="text-gray-600 text-sm mb-6">
          This password reset link is invalid or has expired.
        </p>
        <a
          href="/forgot-password"
          className="block text-center border px-4 py-2 w-full rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Request New Reset Link
        </a>
        <p className="mt-4 text-sm text-center">
          <a className="underline text-blue-600" href="/login">
            Back to Sign In
          </a>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
      <p className="text-gray-600 text-sm mb-6">
        Enter your new password below.
      </p>
      
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
          ✅ {success}
          <div className="mt-2">
            <p className="text-sm">Redirecting to login page...</p>
            <a href="/login?passwordReset=true" className="underline font-semibold">
              Go to Sign In Now
            </a>
          </div>
        </div>
      )}
      
      {!success && (
        <form
          action={async (formData) => {
            setError(undefined);
            setSuccess(undefined);
            setLoading(true);
            
            // Add token and email to form data
            formData.append("token", token);
            formData.append("email", email);
            
            const res = await resetPassword(formData);
            setLoading(false);
            
            if (!res.ok) {
              setError(res.error);
              return;
            }
            
            setSuccess(res.message);
            // Redirect to login after 2 seconds
            setTimeout(() => {
              router.push("/login?passwordReset=true");
            }, 2000);
          }}
          className="space-y-3"
        >
          <input
            name="password"
            type="password"
            placeholder="New Password (min 6 chars)"
            className="border p-2 w-full rounded"
            required
            minLength={6}
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm New Password"
            className="border p-2 w-full rounded"
            required
            minLength={6}
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button 
            type="submit"
            disabled={loading}
            className="border px-4 py-2 w-full rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      )}
      
      {!success && (
        <p className="mt-4 text-sm text-center">
          <a className="underline text-blue-600" href="/login">
            Back to Sign In
          </a>
        </p>
      )}
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-sm p-6">
        <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
        <p className="text-gray-600 text-sm">Loading...</p>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
