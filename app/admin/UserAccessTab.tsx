"use client";

import { useEffect, useState } from "react";
import {
  getUserAccessOverrides,
  getAllUsersWithAccess,
  updateUserAccess,
  AVAILABLE_COMPONENTS,
} from "./user-access-actions";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

interface AccessOverride {
  id: string;
  userId: string;
  componentName: string;
  access: string;
  notes: string | null;
  user: User;
}

export default function UserAccessTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [overrides, setOverrides] = useState<AccessOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(undefined);

    const [usersRes, overridesRes] = await Promise.all([
      getAllUsersWithAccess(),
      getUserAccessOverrides(),
    ]);

    if (!usersRes.ok) {
      setError(usersRes.error);
      setLoading(false);
      return;
    }

    if (!overridesRes.ok) {
      setError(overridesRes.error);
      setLoading(false);
      return;
    }

    setUsers(usersRes.users as User[]);
    setOverrides(overridesRes.overrides as AccessOverride[]);
    setLoading(false);
  };

  const getAccessForUserComponent = (userId: string, componentName: string): "allowed" | "not_allowed" | null => {
    const override = overrides.find(
      (o) => o.userId === userId && o.componentName === componentName
    );
    return override ? (override.access as "allowed" | "not_allowed") : null;
  };

  const handleAccessChange = async (
    userId: string,
    componentName: string,
    access: "allowed" | "not_allowed"
  ) => {
    const key = `${userId}-${componentName}`;
    setSaving({ ...saving, [key]: true });
    setError(undefined);
    setSuccess(undefined);

    const res = await updateUserAccess(userId, componentName, access);

    if (!res.ok) {
      setError(res.error);
      setSaving({ ...saving, [key]: false });
      return;
    }

    setSuccess("Access updated successfully!");
    
    // Update local state
    const existingIndex = overrides.findIndex(
      (o) => o.userId === userId && o.componentName === componentName
    );

    if (existingIndex >= 0) {
      const updated = [...overrides];
      updated[existingIndex] = {
        ...updated[existingIndex],
        access,
      };
      setOverrides(updated);
    } else {
      // Add new override
      const user = users.find((u) => u.id === userId);
      if (user) {
        setOverrides([
          ...overrides,
          {
            id: `temp-${Date.now()}`,
            userId,
            componentName,
            access,
            notes: null,
            user,
          },
        ]);
      }
    }

    setSaving({ ...saving, [key]: false });
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(undefined), 3000);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-100 text-red-700";
      case "MANAGER":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow border border-gray-200 p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading user access settings...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">User Access Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          Control dashboard visibility and access for each individual user. These settings override role-based permissions.
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          ✓ {success}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              {AVAILABLE_COMPONENTS.map((component) => (
                <th
                  key={component.name}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {component.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {user.name || "No name"}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      user.role
                    )}`}
                  >
                    {user.role}
                  </span>
                </td>
                {AVAILABLE_COMPONENTS.map((component) => {
                  const currentAccess = getAccessForUserComponent(
                    user.id,
                    component.name
                  );
                  const key = `${user.id}-${component.name}`;
                  const isSaving = saving[key] || false;

                  return (
                    <td key={component.name} className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={currentAccess || ""}
                        onChange={(e) => {
                          const value = e.target.value as "allowed" | "not_allowed" | "";
                          if (value === "") {
                            // Remove override (use role-based default)
                            // For now, we'll set to "allowed" to match role default
                            // In a full implementation, you might want a "default" option
                            return;
                          }
                          handleAccessChange(user.id, component.name, value);
                        }}
                        disabled={isSaving}
                        className={`min-w-[140px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                          isSaving ? "opacity-50 cursor-not-allowed" : ""
                        } ${
                          currentAccess === "not_allowed"
                            ? "bg-red-50 text-red-700"
                            : currentAccess === "allowed"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-50 text-gray-700"
                        }`}
                      >
                        <option value="">Default (Role-based)</option>
                        <option value="allowed">Allowed</option>
                        <option value="not_allowed">Not Allowed</option>
                      </select>
                      {isSaving && (
                        <span className="ml-2 text-xs text-gray-500">Saving...</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No users found.
        </div>
      )}
    </div>
  );
}

