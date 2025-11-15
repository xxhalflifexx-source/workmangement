"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "../(auth)/actions";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-bold mb-4">Create account</h1>
      <form
        action={async (formData) => {
          const res = await registerUser(formData);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          // Redirect to verification page with email
          router.push(`/verify?email=${encodeURIComponent(res.email || "")}`);
        }}
        className="space-y-3"
      >
        <input
          name="name"
          placeholder="Name"
          className="border p-2 w-full rounded"
          required
        />
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
          placeholder="Password (min 6 chars)"
          className="border p-2 w-full rounded"
          required
        />
        <input
          name="registrationCode"
          type="password"
          placeholder="Registration Code (optional)"
          className="border p-2 w-full rounded"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="border px-4 py-2 w-full rounded bg-blue-600 text-white hover:bg-blue-700">
          Register
        </button>
      </form>
      <p className="mt-3 text-sm text-center">
        Already have an account?{" "}
        <a className="underline text-blue-600" href="/login">
          Sign in
        </a>
      </p>
    </main>
  );
}

