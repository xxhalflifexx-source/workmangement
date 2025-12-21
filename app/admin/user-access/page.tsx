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
  // IMPORTANT: All 10 modules must be included here for the table to display correctly
  const modules: { key: ModulePermission; label: string }[] = [
    { key: "timeClock", label: "Time Clock" },
    { key: "jobManagement", label: "Job Management" },
    { key: "qualityControl", label: "Quality Control" },
    { key: "hr", label: "HR" },
    { key: "finance", label: "Finance" },
    { key: "inventory", label: "Inventory" },
    { key: "adminPanel", label: "Admin Panel" },
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
            href="/admin"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            ← Back to Admin Panel
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
      <header className="bg-black border-b-2 border-[#001f3f] shadow-lg sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">🔐 User Access Control</h1>
            <p className="text-xs sm:text-sm text-gray-300">Manage module access permissions for employees</p>
          </div>
          <Link
            href="/admin"
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-4 py-2 border border-gray-400 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium text-white"
          >
            ← Back to Admin Panel
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
        <div className="bg-white border border-blue-100 rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            <div className="text-sm text-gray-700">
              <strong className="text-blue-600">Tip:</strong> Toggle access per module, then click <span className="font-semibold">Save</span> to apply. Changes take effect immediately.
            </div>
            <div className="text-xs text-gray-500">
              Green = Allowed • Red = Denied • Total Modules: {modules.length}
            </div>
          </div>
          <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
            <strong>Expected columns:</strong> Employee, {modules.map(m => m.label).join(", ")}, Actions
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-visible">
          <div className="overflow-x-auto overflow-y-visible" style={{ width: "100%", maxWidth: "100%" }}>
            <table className="divide-y divide-gray-200" style={{ minWidth: "1400px", width: "max-content" }}>
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10 min-w-[180px]">
                    Employee
                  </th>
                  <th key="header-timeClock" className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px] whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">Time Clock</span>
                    </div>
                  </th>
                  <th key="header-jobManagement" className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px] whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">Job Management</span>
                    </div>
                  </th>
                  <th key="header-qualityControl" className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px] whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">Quality Control</span>
                    </div>
                  </th>
                  <th key="header-hr" className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px] whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">HR</span>
                    </div>
                  </th>
                  <th key="header-finance" className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px] whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">Finance</span>
                    </div>
                  </th>
                  <th key="header-inventory" className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px] whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">Inventory</span>
                    </div>
                  </th>
                  <th key="header-adminPanel" className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px] whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">Admin Panel</span>
                    </div>
                  </th>
                  <th key="header-manual" className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px] whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">Manual</span>
                    </div>
                  </th>
                  <th key="header-operationsCommon" className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px] whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">Operations Common</span>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider sticky right-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10 min-w-[100px]">
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
                        <td className="px-3 py-4 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-200 min-w-[180px]">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {user.name || "Unknown"}
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">{user.email}</div>
                            <div className="text-xs text-gray-400 mt-1 font-medium">{user.role}</div>
                          </div>
                        </td>
                        <td key={`${user.id}-timeClock`} className="px-2 py-4 whitespace-nowrap text-center min-w-[100px]">
                          <button
                            onClick={() => togglePermission(user.id, "timeClock")}
                            disabled={saving[user.id]}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-all duration-200 ${
                              (userPermissions.timeClock ?? false)
                                ? "text-green-700 hover:text-green-800 hover:scale-110"
                                : "text-red-700 hover:text-red-800 hover:scale-110"
                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            title={`Time Clock: ${(userPermissions.timeClock ?? false) ? "Allowed" : "Denied"}`}
                          >
                            <span className="text-lg font-bold">{(userPermissions.timeClock ?? false) ? "✓" : "✗"}</span>
                          </button>
                        </td>
                        <td key={`${user.id}-jobManagement`} className="px-2 py-4 whitespace-nowrap text-center min-w-[100px]">
                          <button
                            onClick={() => togglePermission(user.id, "jobManagement")}
                            disabled={saving[user.id]}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-all duration-200 ${
                              (userPermissions.jobManagement ?? false)
                                ? "text-green-700 hover:text-green-800 hover:scale-110"
                                : "text-red-700 hover:text-red-800 hover:scale-110"
                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            title={`Job Management: ${(userPermissions.jobManagement ?? false) ? "Allowed" : "Denied"}`}
                          >
                            <span className="text-lg font-bold">{(userPermissions.jobManagement ?? false) ? "✓" : "✗"}</span>
                          </button>
                        </td>
                        <td key={`${user.id}-qualityControl`} className="px-2 py-4 whitespace-nowrap text-center min-w-[100px]">
                          <button
                            onClick={() => togglePermission(user.id, "qualityControl")}
                            disabled={saving[user.id]}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-all duration-200 ${
                              (userPermissions.qualityControl ?? false)
                                ? "text-green-700 hover:text-green-800 hover:scale-110"
                                : "text-red-700 hover:text-red-800 hover:scale-110"
                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            title={`Quality Control: ${(userPermissions.qualityControl ?? false) ? "Allowed" : "Denied"}`}
                          >
                            <span className="text-lg font-bold">{(userPermissions.qualityControl ?? false) ? "✓" : "✗"}</span>
                          </button>
                        </td>
                        <td key={`${user.id}-hr`} className="px-2 py-4 whitespace-nowrap text-center min-w-[100px]">
                          <button
                            onClick={() => togglePermission(user.id, "hr")}
                            disabled={saving[user.id]}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-all duration-200 ${
                              (userPermissions.hr ?? false)
                                ? "text-green-700 hover:text-green-800 hover:scale-110"
                                : "text-red-700 hover:text-red-800 hover:scale-110"
                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            title={`HR: ${(userPermissions.hr ?? false) ? "Allowed" : "Denied"}`}
                          >
                            <span className="text-lg font-bold">{(userPermissions.hr ?? false) ? "✓" : "✗"}</span>
                          </button>
                        </td>
                        <td key={`${user.id}-finance`} className="px-2 py-4 whitespace-nowrap text-center min-w-[100px]">
                          <button
                            onClick={() => togglePermission(user.id, "finance")}
                            disabled={saving[user.id]}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-all duration-200 ${
                              (userPermissions.finance ?? false)
                                ? "text-green-700 hover:text-green-800 hover:scale-110"
                                : "text-red-700 hover:text-red-800 hover:scale-110"
                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            title={`Finance: ${(userPermissions.finance ?? false) ? "Allowed" : "Denied"}`}
                          >
                            <span className="text-lg font-bold">{(userPermissions.finance ?? false) ? "✓" : "✗"}</span>
                          </button>
                        </td>
                        <td key={`${user.id}-inventory`} className="px-2 py-4 whitespace-nowrap text-center min-w-[100px]">
                          <button
                            onClick={() => togglePermission(user.id, "inventory")}
                            disabled={saving[user.id]}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-all duration-200 ${
                              (userPermissions.inventory ?? false)
                                ? "text-green-700 hover:text-green-800 hover:scale-110"
                                : "text-red-700 hover:text-red-800 hover:scale-110"
                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            title={`Inventory: ${(userPermissions.inventory ?? false) ? "Allowed" : "Denied"}`}
                          >
                            <span className="text-lg font-bold">{(userPermissions.inventory ?? false) ? "✓" : "✗"}</span>
                          </button>
                        </td>
                        <td key={`${user.id}-adminPanel`} className="px-2 py-4 whitespace-nowrap text-center min-w-[100px]">
                          <button
                            onClick={() => togglePermission(user.id, "adminPanel")}
                            disabled={saving[user.id]}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-all duration-200 ${
                              (userPermissions.adminPanel ?? false)
                                ? "text-green-700 hover:text-green-800 hover:scale-110"
                                : "text-red-700 hover:text-red-800 hover:scale-110"
                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            title={`Admin Panel: ${(userPermissions.adminPanel ?? false) ? "Allowed" : "Denied"}`}
                          >
                            <span className="text-lg font-bold">{(userPermissions.adminPanel ?? false) ? "✓" : "✗"}</span>
                          </button>
                        </td>
                        <td key={`${user.id}-manual`} className="px-2 py-4 whitespace-nowrap text-center min-w-[100px]">
                          <button
                            onClick={() => togglePermission(user.id, "manual")}
                            disabled={saving[user.id]}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-all duration-200 ${
                              (userPermissions.manual ?? false)
                                ? "text-green-700 hover:text-green-800 hover:scale-110"
                                : "text-red-700 hover:text-red-800 hover:scale-110"
                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            title={`Manual: ${(userPermissions.manual ?? false) ? "Allowed" : "Denied"}`}
                          >
                            <span className="text-lg font-bold">{(userPermissions.manual ?? false) ? "✓" : "✗"}</span>
                          </button>
                        </td>
                        <td key={`${user.id}-operationsCommon`} className="px-2 py-4 whitespace-nowrap text-center min-w-[100px]">
                          <button
                            onClick={() => togglePermission(user.id, "operationsCommon")}
                            disabled={saving[user.id]}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-all duration-200 ${
                              (userPermissions.operationsCommon ?? false)
                                ? "text-green-700 hover:text-green-800 hover:scale-110"
                                : "text-red-700 hover:text-red-800 hover:scale-110"
                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            title={`Operations Common: ${(userPermissions.operationsCommon ?? false) ? "Allowed" : "Denied"}`}
                          >
                            <span className="text-lg font-bold">{(userPermissions.operationsCommon ?? false) ? "✓" : "✗"}</span>
                          </button>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-center sticky right-0 bg-white z-10 border-l border-gray-200 min-w-[100px]">
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

