"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface AccessibleComponent {
  name: string;
  href: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

export default function DashboardLinks() {
  const { data: session } = useSession();
  const [accessibleComponents, setAccessibleComponents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAccessibleComponents = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const userId = (session.user as any).id;
      const userRole = (session.user as any).role;

      // Admins have access to everything
      if (userRole === "ADMIN") {
        setAccessibleComponents([
          "jobs",
          "qc",
          "finance",
          "hr",
          "inventory",
          "materials",
          "time-clock",
        ]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/user-accessible-components?userId=${userId}`);
        const data = await res.json();

        if (data.components) {
          setAccessibleComponents(data.components);
        } else {
          // Fallback to role-based
          const roleBasedAccess: Record<string, string[]> = {
            jobs: ["ADMIN", "MANAGER", "EMPLOYEE"],
            "time-clock": ["ADMIN", "MANAGER", "EMPLOYEE"],
            qc: ["ADMIN", "MANAGER"],
            finance: ["ADMIN", "MANAGER"],
            hr: ["ADMIN", "MANAGER"],
            inventory: ["ADMIN", "MANAGER"],
            materials: ["ADMIN", "MANAGER", "EMPLOYEE"],
          };

          const allowed: string[] = [];
          Object.keys(roleBasedAccess).forEach((component) => {
            if (roleBasedAccess[component].includes(userRole)) {
              allowed.push(component);
            }
          });
          setAccessibleComponents(allowed);
        }
      } catch (error) {
        console.error("Error loading accessible components:", error);
        // Fallback to role-based
        const roleBasedAccess: Record<string, string[]> = {
          jobs: ["ADMIN", "MANAGER", "EMPLOYEE"],
          "time-clock": ["ADMIN", "MANAGER", "EMPLOYEE"],
          qc: ["ADMIN", "MANAGER"],
          finance: ["ADMIN", "MANAGER"],
          hr: ["ADMIN", "MANAGER"],
          inventory: ["ADMIN", "MANAGER"],
          materials: ["ADMIN", "MANAGER", "EMPLOYEE"],
        };

        const allowed: string[] = [];
        Object.keys(roleBasedAccess).forEach((component) => {
          if (roleBasedAccess[component].includes(userRole)) {
            allowed.push(component);
          }
        });
        setAccessibleComponents(allowed);
      } finally {
        setLoading(false);
      }
    };

    loadAccessibleComponents();
  }, [session]);

  const allComponents: AccessibleComponent[] = [
    {
      name: "time-clock",
      href: "/time-clock",
      icon: "⏰",
      title: "Time Clock",
      description: "Clock in/out and view your hours",
      badge: "Quick Access",
    },
    {
      name: "jobs",
      href: "/jobs",
      icon: "📋",
      title: "Jobs",
      description: "View and manage job assignments",
      badge: "Active",
    },
    {
      name: "qc",
      href: "/qc",
      icon: "✅",
      title: "Quality Control",
      description: "Review and approve completed work",
    },
    {
      name: "finance",
      href: "/finance",
      icon: "💰",
      title: "Finance",
      description: "Track revenue, expenses, and profitability",
    },
    {
      name: "hr",
      href: "/hr",
      icon: "👥",
      title: "HR",
      description: "View employee statistics and time entries",
    },
    {
      name: "inventory",
      href: "/inventory",
      icon: "📦",
      title: "Inventory",
      description: "Manage stock levels and materials",
    },
    {
      name: "materials",
      href: "/material-requests",
      icon: "🛠️",
      title: "Materials Requested",
      description: "Request and track material orders",
    },
  ];

  const visibleComponents = allComponents.filter((comp) =>
    accessibleComponents.includes(comp.name)
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow p-4 sm:p-6 border border-gray-200 animate-pulse"
          >
            <div className="h-12 bg-gray-200 rounded mb-4"></div>
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
      {visibleComponents.map((component) => (
        <Link
          key={component.name}
          href={component.href}
          className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-200 hover:border-blue-300 min-h-[44px] flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
              {component.icon}
            </div>
            {component.badge && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {component.badge}
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
            {component.title}
          </h3>
          <p className="text-gray-600 text-xs sm:text-sm">{component.description}</p>
        </Link>
      ))}
    </div>
  );
}

