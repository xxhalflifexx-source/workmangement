"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  getAllUsersWithPermissions,
  updateUserPermissions,
} from "../user-access-actions";
import {
  UserPermissions,
  ModulePermission,
  getModuleNames,
  DEFAULT_PERMISSIONS,
} from "@/lib/permissions";

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

  const moduleNames = getModuleNames();
  const modules: ModulePermission[] = [
    "timeClock",
    "jobManagement",
    "qualityControl",
    "hr",
    "finance",
    "inventory",
    "adminPanel",
    "employeeHandbook",
    "manual",
    "operationsCommon",
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
            Green = Allowed • Red = Denied
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  {modules.map((module) => (
                    <th
                      key={module}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {moduleNames[module]}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.name || "Unknown"}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                            <div className="text-xs text-gray-400 mt-1">{user.role}</div>
                          </div>
                        </td>
                        {modules.map((module) => {
                          const hasAccess = userPermissions[module] ?? false;
                          return (
                            <td key={module} className="px-4 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => togglePermission(user.id, module)}
                                disabled={saving[user.id]}
                                className={`inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                                  hasAccess
                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                    : "bg-red-100 text-red-700 hover:bg-red-200"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={hasAccess ? "Allowed" : "Denied"}
                              >
                                {hasAccess ? "✓" : "✗"}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleSave(user.id)}
                            disabled={saving[user.id] || !hasChanges}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                              hasChanges
                                ? "bg-blue-600 text-white hover:bg-blue-700"
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

