"use client";

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

interface UserAccessControlContentProps {
  users: UserWithPermissions[];
  loading: boolean;
  permissions: Record<string, UserPermissions>;
  saving: Record<string, boolean>;
  onLoad?: () => void;
  onToggle: (userId: string, module: ModulePermission) => void;
  onSave: (userId: string) => Promise<void>;
}

export default function UserAccessControlContent({
  users,
  loading,
  permissions,
  saving,
  onToggle,
  onSave,
}: UserAccessControlContentProps) {
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

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading user permissions...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
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
          <tbody className="bg-white divide-y divide-gray-200">
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
                  <tr key={user.id} className="hover:bg-gray-50">
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
                            onClick={() => onToggle(user.id, module)}
                            disabled={saving[user.id]}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-all duration-200 font-sans ${
                              hasAccess
                                ? "text-green-700 hover:text-green-800 hover:scale-110"
                                : "text-red-700 hover:text-red-800 hover:scale-110"
                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                            title={hasAccess ? "Allowed" : "Denied"}
                          >
                            <span className="text-base font-medium leading-none">{hasAccess ? "✓" : "✗"}</span>
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => onSave(user.id)}
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
  );
}

