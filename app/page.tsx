import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  // Check if user is already logged in
  const session = await getServerSession(authOptions);
  
  // If logged in, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  // If not logged in, show welcome page
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



