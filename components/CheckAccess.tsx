"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AccessDenied from "./AccessDenied";

interface CheckAccessProps {
  componentName: string;
  children: React.ReactNode;
}

export default function CheckAccess({ componentName, children }: CheckAccessProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (status === "loading") return;

      if (!session?.user) {
        router.push("/login");
        return;
      }

      const userId = (session.user as any).id;
      const userRole = (session.user as any).role;

      // Admins always have access
      if (userRole === "ADMIN") {
        setHasAccess(true);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/check-access?userId=${userId}&componentName=${componentName}`);
        const data = await res.json();

        if (data.hasAccess) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error("Error checking access:", error);
        // Default to role-based access on error
        const roleBasedAccess: Record<string, string[]> = {
          jobs: ["ADMIN", "MANAGER", "EMPLOYEE"],
          "time-clock": ["ADMIN", "MANAGER", "EMPLOYEE"],
          qc: ["ADMIN", "MANAGER"],
          finance: ["ADMIN", "MANAGER"],
          hr: ["ADMIN", "MANAGER"],
          inventory: ["ADMIN", "MANAGER"],
          materials: ["ADMIN", "MANAGER", "EMPLOYEE"],
        };

        const allowedRoles = roleBasedAccess[componentName] || [];
        setHasAccess(allowedRoles.includes(userRole));
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [session, status, componentName, router]);

  if (loading || hasAccess === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

