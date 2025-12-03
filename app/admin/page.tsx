"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAllUsersForAdmin,
  deleteUser,
  updateUserRole,
  updateUserHourlyRate,
  getCompanySettings,
  updateCompanySettings,
  updateUserProfileDetails,
  resetUserPasswordByAdmin,
} from "./actions";
import Link from "next/link";
import { useSession } from "next-auth/react";
import RegistrationCodes from "../dashboard/RegistrationCodes";
import { formatDateShort, formatDateInput, todayCentralISO, nowInCentral, utcToCentral } from "@/lib/date-utils";
import {
  getAllUsersWithPermissions,
  updateUserPermissions,
} from "./user-access-actions";
import {
  UserPermissions,
  DEFAULT_PERMISSIONS,
} from "@/lib/permissions";
import UserAccessControlContent from "./UserAccessControlContent";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  gender?: string | null;
  birthDate?: string | null;
  status?: string | null;
  hourlyRate: number | null;
  isVerified: boolean;
  createdAt: string;
  _count: {
    timeEntries: number;
    assignedJobs: number;
  };
}

interface CompanySettings {
  companyName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  website: string;
}

interface UserWithPermissions {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  permissions: UserPermissions;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<"users" | "settings" | "registration-codes" | "user-access">("users");
  
  // User Access Control state
  const [accessUsers, setAccessUsers] = useState<UserWithPermissions[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSaving, setAccessSaving] = useState<Record<string, boolean>>({});
  const [accessPermissions, setAccessPermissions] = useState<Record<string, UserPermissions>>({});
  
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const currentUserId = (session?.user as any)?.id;
  const isAdmin = userRole === "ADMIN";
  const canManageRoles = userRole === "ADMIN" || userRole === "MANAGER";

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState<{ userId: string; newRole: string; userName: string; currentRole: string } | null>(null);
  const [userSearch, setUserSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    const [usersRes, settingsRes] = await Promise.all([
      getAllUsersForAdmin(),
      getCompanySettings(),
    ]);

    if (!usersRes.ok) {
      setError(usersRes.error);
    } else {
      setUsers(usersRes.users as any);
    }

    if (settingsRes.ok) {
      setSettings(settingsRes.settings as any);
    }

    setLoading(false);
  }, []);

  const loadAccessUsers = useCallback(async () => {
    setAccessLoading(true);
    setError(undefined);
    const res = await getAllUsersWithPermissions();
    if (!res.ok) {
      setError(res.error);
      setAccessUsers([]);
    } else {
      const usersList = res.users || [];
      setAccessUsers(usersList as any);
      // Initialize permissions state
      const perms: Record<string, UserPermissions> = {};
      usersList.forEach((user: any) => {
        perms[user.id] = user.permissions;
      });
      setAccessPermissions(perms);
    }
    setAccessLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === "user-access" && isAdmin) {
      loadAccessUsers();
    }
  }, [activeTab, isAdmin, loadAccessUsers]);

  const handleDeleteUser = async (userId: string) => {
    setError(undefined);
    setSuccess(undefined);

    const res = await deleteUser(userId);

    if (!res.ok) {
      setError(res.error);
    } else {
      setSuccess(res.message);
      setUsers(users.filter((u) => u.id !== userId));
    }

    setShowDeleteConfirm(null);
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    
    // If role hasn't changed, do nothing
    if (user.role === newRole) return;
    
    // Show confirmation modal
    setShowRoleChangeConfirm({
      userId,
      newRole,
      userName: user.name || user.email || "Unknown User",
      currentRole: user.role,
    });
  };

  const handleRoleChangeConfirm = async () => {
    if (!showRoleChangeConfirm) return;
    
    setError(undefined);
    setSuccess(undefined);

    const res = await updateUserRole(showRoleChangeConfirm.userId, showRoleChangeConfirm.newRole);

    if (!res.ok) {
      setError(res.error);
      // Revert the dropdown to original role on error
      setUsers(
        users.map((u) => 
          u.id === showRoleChangeConfirm.userId 
            ? { ...u, role: showRoleChangeConfirm.currentRole } 
            : u
        )
      );
    } else {
      setSuccess(res.message);
      setUsers(
        users.map((u) => 
          u.id === showRoleChangeConfirm.userId 
            ? { ...u, role: showRoleChangeConfirm.newRole } 
            : u
        )
      );
    }

    setShowRoleChangeConfirm(null);
  };

  const handleRoleChangeCancel = () => {
    if (!showRoleChangeConfirm) return;
    
    // Revert the dropdown to original role
    setUsers(
      users.map((u) => 
        u.id === showRoleChangeConfirm.userId 
          ? { ...u, role: showRoleChangeConfirm.currentRole } 
          : u
      )
    );
    
    setShowRoleChangeConfirm(null);
  };

  const handleHourlyRateChange = async (userId: string, hourlyRate: number) => {
    setError(undefined);
    setSuccess(undefined);

    const res = await updateUserHourlyRate(userId, hourlyRate);

    if (!res.ok) {
      setError(res.error);
    } else {
      setSuccess(res.message);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, hourlyRate } : u))
      );
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const formData = new FormData(e.currentTarget);
    const res = await updateCompanySettings(formData);

    if (!res.ok) {
      setError(res.error);
    } else {
      setSuccess(res.message);
    }
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

  const formatDate = (dateString: string) => {
    return formatDateShort(dateString);
  };

  const handleGenderChange = async (userId: string, gender: string) => {
    setError(undefined);
    setSuccess(undefined);
    const res = await updateUserProfileDetails(userId, gender, undefined);
    if (!res.ok) {
      setError(res.error);
    } else {
      setSuccess(res.message);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, gender: gender || null } : u))
      );
    }
  };

  const handleBirthDateChange = async (userId: string, birthDate: string) => {
    setError(undefined);
    setSuccess(undefined);
    const res = await updateUserProfileDetails(userId, undefined, birthDate || undefined);
    if (!res.ok) {
      setError(res.error);
    } else {
      setSuccess(res.message);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, birthDate: birthDate || null } : u))
      );
    }
  };

  const handleStatusChange = async (userId: string, status: string) => {
    setError(undefined);
    setSuccess(undefined);
    const res = await updateUserProfileDetails(userId, undefined, undefined, status || undefined);
    if (!res.ok) {
      setError(res.error);
    } else {
      setSuccess(res.message);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, status: status || null } : u))
      );
    }
  };

  const handleResetPassword = async (userId: string) => {
    const confirmReset = window.confirm(
      "Reset this user's password and generate a new temporary password?"
    );
    if (!confirmReset) return;

    setError(undefined);
    setSuccess(undefined);
    const res = await resetUserPasswordByAdmin(userId);
    if (!res.ok) {
      setError(res.error);
    } else {
      setSuccess(
        `Temporary password for ${res.email}: ${res.tempPassword}. Please send this to the employee securely.`
      );
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">⚙️ Administrative Panel</h1>
            <p className="text-xs sm:text-sm text-gray-500">System configuration and user management</p>
          </div>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            ✓ {success}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
              <button
                onClick={() => setActiveTab("users")}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap min-h-[44px] flex items-center ${
                  activeTab === "users"
                    ? "border-red-500 text-red-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                👥 <span className="ml-1 sm:ml-0">User Management</span>
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap min-h-[44px] flex items-center ${
                  activeTab === "settings"
                    ? "border-red-500 text-red-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                🏢 <span className="ml-1 sm:ml-0">Company Settings</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab("registration-codes")}
                  className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap min-h-[44px] flex items-center ${
                    activeTab === "registration-codes"
                      ? "border-purple-500 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  🔑 <span className="ml-1 sm:ml-0">Registration Codes</span>
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setActiveTab("user-access")}
                  className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap min-h-[44px] flex items-center ${
                    activeTab === "user-access"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  🔐 <span className="ml-1 sm:ml-0">User Access Control</span>
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* User Management Tab */}
        {activeTab === "users" && (
          <div className="bg-white rounded-xl shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
              <h2 className="text-xl font-semibold text-gray-900">User Accounts</h2>
              <p className="text-sm text-gray-500 mt-1">
                  Manage user accounts, login access, roles, and approvals
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, or role..."
                  className="border border-gray-300 rounded-lg px-3 py-2.5 sm:py-1.5 text-sm w-full sm:w-56 min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setUserSearch(userSearch.trim())}
                  className="px-4 py-2.5 sm:py-1.5 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-200 min-h-[44px] sm:min-h-0"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  No users found
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div key={user.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-red-600 font-medium text-base">
                            {(user.name || "U").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {user.name || "Unknown"}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{user.email}</div>
                        </div>
                      </div>
                      {canManageRoles ? (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className={`px-3 py-2 text-xs font-semibold rounded-full ${getRoleBadgeColor(
                            user.role
                          )} border-none outline-none cursor-pointer min-h-[44px]`}
                        >
                          <option value="EMPLOYEE">EMPLOYEE</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-2 text-xs font-semibold rounded-full ${getRoleBadgeColor(
                          user.role
                        )}`}>
                          {user.role}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Gender</label>
                        <select
                          value={user.gender || ""}
                          onChange={(e) => handleGenderChange(user.id, e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 min-h-[44px]"
                        >
                          <option value="">Not specified</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Hourly Rate</label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-gray-900">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={user.hourlyRate || ""}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) || e.target.value === "") {
                                handleHourlyRateChange(user.id, value || 0);
                              }
                            }}
                            placeholder="0.00"
                            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[44px]"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Birth Date</label>
                      <input
                        type="date"
                        value={
                          user.birthDate
                            ? formatDateInput(user.birthDate as string)
                            : ""
                        }
                        onChange={(e) => handleBirthDateChange(user.id, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px]"
                      />
                      {user.birthDate && (
                        <span className="text-xs text-gray-500 mt-1 block">
                          {(() => {
                            const dob = utcToCentral(user.birthDate as string);
                            const now = nowInCentral();
                            let age = now.year() - dob.year();
                            const m = now.month() - dob.month();
                            if (m < 0 || (m === 0 && now.date() < dob.date())) {
                              age--;
                            }
                            const month = dob.format("MMM");
                            return `${age} yrs / ${month}`;
                          })()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {user.isVerified ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⚠ Unverified
                          </span>
                        )}
                        <select
                          value={user.status || "APPROVED"}
                          onChange={(e) => handleStatusChange(user.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border min-h-[44px] ${
                            (user.status || "APPROVED") === "APPROVED"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : (user.status || "APPROVED") === "PENDING"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          <option value="APPROVED">APPROVED</option>
                          <option value="PENDING">PENDING</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-200">
                      <div>
                        <span>{user._count.timeEntries} entries</span>
                        <span className="mx-2">•</span>
                        <span>{user._count.assignedJobs} jobs</span>
                      </div>
                      <span>{formatDate(user.createdAt)}</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setShowDeleteConfirm(user.id)}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 min-h-[44px]"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 min-h-[44px]"
                      >
                        Reset PW
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gender
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Age / Birth&nbsp;Month
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hourly Rate
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email&nbsp;Verified
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approval&nbsp;Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activity
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                  filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center min-w-0">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                              <span className="text-red-600 font-medium text-sm">
                                {(user.name || "U").charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4 min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {user.name || "Unknown"}
                              </div>
                              <div className="text-sm text-gray-500 truncate">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {canManageRoles ? (
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(
                              user.role
                            )} border-none outline-none cursor-pointer`}
                          >
                            <option value="EMPLOYEE">EMPLOYEE</option>
                            <option value="MANAGER">MANAGER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                          ) : (
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(
                              user.role
                            )}`}>
                              {user.role}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <select
                            value={user.gender || ""}
                            onChange={(e) => handleGenderChange(user.id, e.target.value)}
                            className="border border-gray-300 rounded-full px-2 py-1 text-xs bg-gray-50"
                          >
                            <option value="">Not specified</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="date"
                              value={
                                user.birthDate
                                  ? formatDateInput(user.birthDate as string)
                                  : ""
                              }
                              onChange={(e) => handleBirthDateChange(user.id, e.target.value)}
                              className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                            />
                            <span className="text-[11px] text-gray-500">
                              {user.birthDate
                                ? (() => {
                                    const dob = utcToCentral(user.birthDate as string);
                                    const now = nowInCentral();
                                    let age = now.year() - dob.year();
                                    const m = now.month() - dob.month();
                                    if (m < 0 || (m === 0 && now.date() < dob.date())) {
                                      age--;
                                    }
                                    const month = dob.format("MMM");
                                    return `${age} yrs / ${month}`;
                                  })()
                                : "Age / Month"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-sm font-medium text-gray-900">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={user.hourlyRate || ""}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) || e.target.value === "") {
                                  handleHourlyRateChange(user.id, value || 0);
                                }
                              }}
                              placeholder="0.00"
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center"
                            />
                            <span className="text-xs text-gray-500">/hr</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {user.isVerified ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              ⚠ Unverified
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <select
                            value={user.status || "APPROVED"}
                            onChange={(e) => handleStatusChange(user.id, e.target.value)}
                            className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                              (user.status || "APPROVED") === "APPROVED"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : (user.status || "APPROVED") === "PENDING"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            <option value="APPROVED">APPROVED</option>
                            <option value="PENDING">PENDING</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                          <div className="flex flex-col items-center gap-1">
                            <span>{user._count.timeEntries} time entries</span>
                            <span className="text-xs text-gray-400">
                              {user._count.assignedJobs} jobs
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => setShowDeleteConfirm(user.id)}
                            className="text-red-600 hover:text-red-900 min-h-[44px] px-2"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => handleResetPassword(user.id)}
                            className="ml-3 text-blue-600 hover:text-blue-900 min-h-[44px] px-2"
                          >
                            Reset PW
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-600">
                <strong>Note:</strong> Deleting a user will remove all their data including time
                entries and job assignments. This action cannot be undone.
              </p>
            </div>
          </div>
        )}

        {/* Company Settings Tab */}
        {activeTab === "settings" && settings && (
          <div className="bg-white rounded-xl shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Company Information</h2>
              <p className="text-sm text-gray-500 mt-1">
                Update company details that appear on invoices and documents
              </p>
            </div>

            <form onSubmit={handleSettingsSubmit} className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    name="companyName"
                    type="text"
                    defaultValue={settings.companyName}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 sm:py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[44px]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address
                  </label>
                  <input
                    name="address"
                    type="text"
                    defaultValue={settings.address}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 sm:py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    name="city"
                    type="text"
                    defaultValue={settings.city}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 sm:py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[44px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                    <input
                      name="state"
                      type="text"
                      defaultValue={settings.state}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 sm:py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      name="zipCode"
                      type="text"
                      defaultValue={settings.zipCode}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 sm:py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={settings.phone}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 sm:py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={settings.email}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 sm:py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                  <input
                    name="website"
                    type="text"
                    defaultValue={settings.website}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 sm:py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[44px]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium min-h-[44px]"
                >
                  Save Company Settings
                </button>
              </div>
            </form>
          </div>
        )}


        {/* Registration Codes Tab - Admin Only */}
        {activeTab === "registration-codes" && isAdmin && (
          <div className="bg-white rounded-xl shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Registration Codes</h2>
              <p className="text-sm text-gray-500 mt-1">
                Manage registration codes for new user signups. Only admins can view and manage these codes.
              </p>
            </div>
            <div className="p-6">
              <RegistrationCodes />
            </div>
          </div>
        )}

        {/* Access Denied Message for Non-Admins */}
        {activeTab === "registration-codes" && !isAdmin && (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-8 text-center">
            <div className="text-red-600 text-xl font-bold mb-2">⚠️ Access Denied</div>
            <p className="text-gray-600">
              You do not have permission to view registration codes. Only administrators can access this section.
            </p>
          </div>
        )}

        {/* User Access Control Tab */}
        {activeTab === "user-access" && isAdmin && (
          <div className="bg-white rounded-xl shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">User Access Control</h2>
              <p className="text-sm text-gray-500 mt-1">
                Manage module access permissions for employees. Toggle permissions and click "Save" to apply changes.
              </p>
            </div>
            <UserAccessControlContent
              users={accessUsers}
              loading={accessLoading}
              permissions={accessPermissions}
              saving={accessSaving}
              onLoad={loadAccessUsers}
              onToggle={(userId, module) => {
                setAccessPermissions((prev) => {
                  const current = prev[userId] || DEFAULT_PERMISSIONS;
                  return {
                    ...prev,
                    [userId]: {
                      ...current,
                      [module]: !current[module],
                    },
                  };
                });
              }}
              onSave={async (userId) => {
                setAccessSaving((prev) => ({ ...prev, [userId]: true }));
                setError(undefined);
                setSuccess(undefined);

                const userPermissions = accessPermissions[userId] || DEFAULT_PERMISSIONS;
                const res = await updateUserPermissions(userId, userPermissions);

                if (!res.ok) {
                  setError(res.error);
                  await loadAccessUsers();
                } else {
                  setSuccess(`Permissions updated for ${accessUsers.find((u) => u.id === userId)?.name || "user"}`);
                  setTimeout(() => setSuccess(undefined), 3000);
                  await loadAccessUsers();
                }

                setAccessSaving((prev) => ({ ...prev, [userId]: false }));
              }}
            />
          </div>
        )}

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 my-auto">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">⚠️ Confirm Delete</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              Are you sure you want to delete this user? This will permanently remove:
            </p>
            <ul className="list-disc list-inside text-sm sm:text-base text-gray-600 mb-6 space-y-1">
              <li>User account and profile</li>
              <li>All time entries</li>
              <li>Job assignments</li>
              <li>Activity history</li>
            </ul>
            <p className="text-sm sm:text-base text-red-600 font-semibold mb-6">This action cannot be undone!</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(showDeleteConfirm)}
                className="flex-1 px-4 py-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium min-h-[44px]"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {showRoleChangeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 my-auto">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">⚠️ Confirm Role Change</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              {showRoleChangeConfirm.userId === currentUserId
                ? "Are you sure you want to change your own role? This will affect your permissions immediately."
                : "Are you sure you want to change this user's role?"}
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">User:</span>{" "}
                  <span className="text-gray-900">{showRoleChangeConfirm.userName}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Current Role:</span>{" "}
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(showRoleChangeConfirm.currentRole)}`}>
                    {showRoleChangeConfirm.currentRole}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">New Role:</span>{" "}
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(showRoleChangeConfirm.newRole)}`}>
                    {showRoleChangeConfirm.newRole}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRoleChangeCancel}
                className="flex-1 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChangeConfirm}
                className="flex-1 px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium min-h-[44px]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

