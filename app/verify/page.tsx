"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyEmail, resendVerificationCode } from "../(auth)/actions";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(undefined);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("code", code);

    const res = await verifyEmail(formData);
    
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }

    // Success! Redirect to login
    router.push("/login?verified=true");
  };

  const handleResend = async () => {
    setResending(true);
    setError(undefined);
    setSuccess(undefined);

    const res = await resendVerificationCode(email);
    
    if (!res.ok) {
      setError(res.error);
      setResending(false);
      return;
    }

    setSuccess("New verification code sent! Check your email.");
    setResending(false);
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📧</div>
          <h1 className="text-2xl font-bold mb-2">Verify Your Email</h1>
          <p className="text-gray-600 text-sm">
            We sent a 6-digit code to
          </p>
          <p className="font-semibold text-blue-600 break-all">{email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Enter Verification Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="border p-3 w-full rounded text-center text-2xl font-mono tracking-widest min-h-[44px]"
              maxLength={6}
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Code expires in 15 minutes
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
              ✅ {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed min-h-[44px]"
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Didn't receive the code?
          </p>
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-blue-600 text-sm hover:underline disabled:text-gray-400 disabled:cursor-not-allowed min-h-[44px] px-2"
          >
            {resending ? "Sending..." : "Resend Code"}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t text-center">
          <p className="text-sm text-gray-600">
            Wrong email?{" "}
            <a href="/register" className="text-blue-600 hover:underline">
              Register again
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6">Loading…</main>}>
      <VerifyContent />
    </Suspense>
  );
}

