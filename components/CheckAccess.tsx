"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasPermission, ModulePermission, UserPermissions } from "@/lib/permissions";

interface CheckAccessProps {
  module: ModulePermission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function CheckAccess({ module, children, fallback }: CheckAccessProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.push("/login");
      return;
    }

    // Fetch user permissions
    const fetchPermissions = async () => {
      try {
        const res = await fetch("/api/user/permissions");
        if (res.ok) {
          const data = await res.json();
          setPermissions(data.permissions);
          const userRole = (session.user as any)?.role;
          
          // Admins always have access
          if (userRole === "ADMIN") {
            setHasAccess(true);
            return;
          }

          // Check permission
          setHasAccess(hasPermission(data.permissions, module));
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
        setHasAccess(false);
      }
    };

    fetchPermissions();
  }, [session, status, module, router]);

  if (status === "loading" || hasAccess === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    router.push("/access-denied");
    return null;
  }

  return <>{children}</>;
}

