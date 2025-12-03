"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { UserPermissions, ModulePermission, hasPermission } from "@/lib/permissions";

export function usePermissions() {
  const { data: session, status } = useSession();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        const res = await fetch("/api/user/permissions");
        if (res.ok) {
          const data = await res.json();
          setPermissions(data.permissions);
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [session, status]);

  const checkPermission = (module: ModulePermission): boolean => {
    if (!session?.user) return false;
    
    const userRole = (session.user as any)?.role;
    
    // Admins always have access
    if (userRole === "ADMIN") {
      return true;
    }

    if (!permissions) return false;
    return hasPermission(permissions, module);
  };

  return {
    permissions,
    loading: loading || status === "loading",
    hasPermission: checkPermission,
    isAdmin: (session?.user as any)?.role === "ADMIN",
  };
}

