"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const verified = searchParams?.get("verified");
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(verified === "true" ? "Email verified! You can now sign in." : undefined);

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-bold mb-4">Sign in</h1>
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
          ✅ {success}
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget as HTMLFormElement);
          const email = formData.get("email") as string;
          const password = formData.get("password") as string;
          
          const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });
          
          if (res?.error) {
            setError("Invalid credentials");
            return;
          }
          
          router.replace("/dashboard");
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
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="border p-2 w-full rounded"
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="text-right">
          <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">
            Forgot password?
          </a>
        </div>
        <button className="border px-4 py-2 w-full rounded bg-blue-600 text-white hover:bg-blue-700">
          Sign In
        </button>
      </form>
      <p className="mt-3 text-sm text-center">
        No account?{" "}
        <a className="underline text-blue-600" href="/register">
          Register
        </a>
      </p>
    </main>
  );
}
