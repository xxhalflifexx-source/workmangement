"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  getAllUsersWithPermissions,
  updateUserPermissions,
} from "../user-access-actions";
import { UserPermissions, ModulePermission, DEFAULT_PERMISSIONS } from "@/lib/permissions";

interface UserWithPermissions {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  permissions: UserPermissions;
}

export default function UserAccessControlPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === "ADMIN";

  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [permissions, setPermissions] = useState<Record<string, UserPermissions>>({});

  // Explicit ordered list with labels to ensure visibility of new modules
  const modules: { key: ModulePermission; label: string }[] = [
    { key: "timeClock", label: "Time Clock" },
    { key: "jobManagement", label: "Job Management" },
    { key: "qualityControl", label: "Quality Control" },
    { key: "hr", label: "HR" },
    { key: "finance", label: "Finance" },
    { key: "inventory", label: "Inventory" },
    { key: "adminPanel", label: "Admin Panel" },
    { key: "employeeHandbook", label: "Employee Handbook" },
    { key: "manual", label: "Manual" },
    { key: "operationsCommon", label: "Operations Common" },
  ];


  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    setLoading(true);
    setError(undefined);
    const res = await getAllUsersWithPermissions();
    if (!res.ok) {
      setError(res.error);
      setUsers([]);
    } else {
      const usersList = res.users || [];
      setUsers(usersList as any);
      // Initialize permissions state
      const perms: Record<string, UserPermissions> = {};
      usersList.forEach((user: any) => {
        perms[user.id] = user.permissions;
      });
      setPermissions(perms);
    }
    setLoading(false);
  };

  const togglePermission = (userId: string, module: ModulePermission) => {
    setPermissions((prev) => {
      const current = prev[userId] || DEFAULT_PERMISSIONS;
      return {
        ...prev,
        [userId]: {
          ...current,
          [module]: !current[module],
        },
      };
    });
  };

  const handleSave = async (userId: string) => {
    setSaving((prev) => ({ ...prev, [userId]: true }));
    setError(undefined);
    setSuccess(undefined);

    const userPermissions = permissions[userId] || DEFAULT_PERMISSIONS;
    const res = await updateUserPermissions(userId, userPermissions);

    if (!res.ok) {
      setError(res.error);
      // Reload to restore original permissions
      await loadUsers();
    } else {
      setSuccess(`Permissions updated for ${users.find((u) => u.id === userId)?.name || "user"}`);
      setTimeout(() => setSuccess(undefined), 3000);
      // Reload users to update the base permissions, which will disable the save button
      await loadUsers();
    }

    setSaving((prev) => ({ ...prev, [userId]: false }));
  };

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-xl shadow-md p-8 max-w-lg text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-gray-600 mb-4">
            Only administrators can access this page.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user permissions...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm border-b text-white">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">🔐 User Access Control</h1>
            <p className="text-xs sm:text-sm text-blue-100">Manage module access permissions for employees</p>
          </div>
          <Link
            href="/admin"
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium backdrop-blur transition-colors text-white border border-white/30"
          >
            Back to Admin Panel
          </Link>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
            <button
              onClick={() => setError(undefined)}
              className="float-right text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            ✓ {success}
            <button
              onClick={() => setSuccess(undefined)}
              className="float-right text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white border border-blue-100 rounded-lg p-4 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-700">
            <strong className="text-blue-600">Tip:</strong> Toggle access per module, then click <span className="font-semibold">Save</span> to apply. Changes take effect immediately.
          </div>
          <div className="text-xs text-gray-500">
            Green = Allowed • Red = Denied • Total Modules: {modules.length}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200" style={{ minWidth: `${(modules.length + 2) * 140}px` }}>
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10">
                    Employee
                  </th>
                  {modules.map(({ key, label }) => {
                    return (
                      <th
                        key={key}
                        className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px] whitespace-nowrap"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span>{label}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 sm:px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider sticky right-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={modules.length + 2} className="px-6 py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const userPermissions = permissions[user.id] || DEFAULT_PERMISSIONS;
                    const hasChanges = JSON.stringify(userPermissions) !== JSON.stringify(user.permissions);

                    return (
                      <tr key={user.id} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-200">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {user.name || "Unknown"}
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">{user.email}</div>
                            <div className="text-xs text-gray-400 mt-1 font-medium">{user.role}</div>
                          </div>
                        </td>
                        {modules.map(({ key, label }) => {
                          const hasAccess = userPermissions[key] ?? false;
                          return (
                            <td key={key} className="px-3 sm:px-4 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => togglePermission(user.id, key)}
                                disabled={saving[user.id]}
                                className={`inline-flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 shadow-sm ${
                                  hasAccess
                                    ? "bg-green-100 text-green-700 hover:bg-green-200 hover:shadow-md hover:scale-110"
                                    : "bg-red-100 text-red-700 hover:bg-red-200 hover:shadow-md hover:scale-110"
                                } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                                title={`${label}: ${hasAccess ? "Allowed" : "Denied"}`}
                              >
                                <span className="text-lg font-bold">{hasAccess ? "✓" : "✗"}</span>
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center sticky right-0 bg-white z-10 border-l border-gray-200">
                          <button
                            onClick={() => handleSave(user.id)}
                            disabled={saving[user.id] || !hasChanges}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-h-[44px] shadow-sm ${
                              hasChanges
                                ? "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95"
                                : "bg-gray-200 text-gray-500 cursor-not-allowed"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {saving[user.id] ? "Saving..." : "Save"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

