"use client";

import { useState } from "react";
import { requestPasswordReset } from "../(auth)/actions";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-bold mb-4">Forgot Password</h1>
      <p className="text-gray-600 text-sm mb-6">
        Enter your email address and we'll send you a link to reset your password.
      </p>
      
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
          ✅ {success}
        </div>
      )}
      
      <form
        action={async (formData) => {
          setError(undefined);
          setSuccess(undefined);
          setLoading(true);
          const res = await requestPasswordReset(formData);
          setLoading(false);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setSuccess(res.message);
        }}
        className="space-y-3"
      >
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="border p-2 w-full rounded"
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button 
          type="submit"
          disabled={loading}
          className="border px-4 py-2 w-full rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
      
      <p className="mt-4 text-sm text-center">
        <a className="underline text-blue-600" href="/login">
          Back to Sign In
        </a>
      </p>
    </main>
  );
}

