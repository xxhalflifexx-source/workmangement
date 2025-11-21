"use client";

import { useEffect, useState } from "react";
import {
  getAllUsersForAdmin,
  deleteUser,
  updateUserRole,
  updateUserHourlyRate,
  getCompanySettings,
  updateCompanySettings,
  getFinancialSummary,
  listActiveInvoices,
  listOpenEstimates,
  updateUserProfileDetails,
  resetUserPasswordByAdmin,
} from "./actions";
import Link from "next/link";

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

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<"users" | "settings" | "financials" | "billing">("users");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingInvoices, setBillingInvoices] = useState<any[]>([]);
  const [billingEstimates, setBillingEstimates] = useState<any[]>([]);

  const [finStart, setFinStart] = useState<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [finEnd, setFinEnd] = useState<string>(new Date().toISOString().split("T")[0]);
  const [finLoading, setFinLoading] = useState(false);
  const [finSummary, setFinSummary] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
  };

  const loadBilling = async () => {
    setBillingLoading(true);
    setError(undefined);
    const [invRes, estRes] = await Promise.all([
      listActiveInvoices(),
      listOpenEstimates(),
    ]);
    if (invRes.ok) setBillingInvoices(invRes.invoices as any);
    if (estRes.ok) setBillingEstimates(estRes.estimates as any);
    if (!invRes.ok) setError(invRes.error);
    if (!estRes.ok) setError(estRes.error);
    setBillingLoading(false);
  };

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

  const handleRoleChange = async (userId: string, newRole: string) => {
    setError(undefined);
    setSuccess(undefined);

    const res = await updateUserRole(userId, newRole);

    if (!res.ok) {
      setError(res.error);
    } else {
      setSuccess(res.message);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    }
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

  const loadFinancials = async () => {
    setFinLoading(true);
    setError(undefined);
    const res = await getFinancialSummary(finStart, finEnd);
    if (!res.ok) {
      setError(res.error);
      setFinSummary(null);
    } else {
      setFinSummary(res.summary);
    }
    setFinLoading(false);
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
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">⚙️ Administrative Panel</h1>
            <p className="text-sm text-gray-500">System configuration and user management</p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("users")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "users"
                    ? "border-red-500 text-red-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                👥 User Management
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "settings"
                    ? "border-red-500 text-red-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                🏢 Company Settings
              </button>
              <button
                onClick={() => setActiveTab("financials")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "financials"
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                💹 Financials
              </button>
              <button
                onClick={() => {
                  setActiveTab("billing");
                  loadBilling();
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "billing"
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                🧾 Billing
              </button>
            </nav>
          </div>
        </div>

        {/* User Management Tab */}
        {activeTab === "users" && (
          <div className="bg-white rounded-xl shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">User Accounts</h2>
              <p className="text-sm text-gray-500 mt-1">
                Manage user accounts, login access, roles, and approvals
              </p>
            </div>

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
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                              <span className="text-red-600 font-medium text-sm">
                                {(user.name || "U").charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {user.name || "Unknown"}
                              </div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                                  ? new Date(user.birthDate as string)
                                      .toISOString()
                                      .split("T")[0]
                                  : ""
                              }
                              onChange={(e) => handleBirthDateChange(user.id, e.target.value)}
                              className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                            />
                            <span className="text-[11px] text-gray-500">
                              {user.birthDate
                                ? (() => {
                                    const dob = new Date(user.birthDate as string);
                                    const now = new Date();
                                    let age = now.getFullYear() - dob.getFullYear();
                                    const m = now.getMonth() - dob.getMonth();
                                    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
                                      age--;
                                    }
                                    const month = dob.toLocaleString("en-US", {
                                      month: "short",
                                    });
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
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => handleResetPassword(user.id)}
                            className="ml-3 text-blue-600 hover:text-blue-900"
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

            <form onSubmit={handleSettingsSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    name="companyName"
                    type="text"
                    defaultValue={settings.companyName}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    name="city"
                    type="text"
                    defaultValue={settings.city}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                    <input
                      name="state"
                      type="text"
                      defaultValue={settings.state}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={settings.phone}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={settings.email}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                  <input
                    name="website"
                    type="text"
                    defaultValue={settings.website}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Save Company Settings
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Financials Tab */}
        {activeTab === "financials" && (
          <div className="bg-white rounded-xl shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Company Financials</h2>
                <p className="text-sm text-gray-500">Revenue, labor, expenses, profit, and bankroll</p>
              </div>
              <div className="flex gap-2 items-center">
                <input type="date" value={finStart} onChange={(e) => setFinStart(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                <span className="text-gray-500">to</span>
                <input type="date" value={finEnd} onChange={(e) => setFinEnd(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                <button onClick={loadFinancials} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">Run</button>
              </div>
            </div>

            {finLoading ? (
              <div className="p-8 text-center text-gray-600">Calculating...</div>
            ) : finSummary ? (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg bg-green-50">
                    <div className="text-sm text-green-700">Revenue</div>
                    <div className="text-2xl font-bold text-green-800">${finSummary.revenue.toFixed(2)}</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-blue-50">
                    <div className="text-sm text-blue-700">Labor Cost</div>
                    <div className="text-2xl font-bold text-blue-800">${finSummary.labor.cost.toFixed(2)}</div>
                    <div className="text-xs text-blue-700">{finSummary.labor.hours.toFixed(2)} hrs</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-yellow-50">
                    <div className="text-sm text-yellow-700">Expenses</div>
                    <div className="text-2xl font-bold text-yellow-800">${finSummary.expenses.total.toFixed(2)}</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-purple-50">
                    <div className="text-sm text-purple-700">Profit</div>
                    <div className={`text-2xl font-bold ${finSummary.profit >= 0 ? "text-purple-800" : "text-red-700"}`}>${finSummary.profit.toFixed(2)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 p-4 border rounded-lg">
                    <h3 className="font-semibold mb-3">Expenses by Category</h3>
                    {Object.keys(finSummary.expenses.byCategory).length === 0 ? (
                      <div className="text-sm text-gray-500">No expenses in this period.</div>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {Object.entries(finSummary.expenses.byCategory).map(([cat, amt]: any) => (
                          <li key={cat} className="flex justify-between"><span>{cat}</span><span className="font-medium">${(amt as number).toFixed(2)}</span></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-3">Bankroll</h3>
                    <div className="text-3xl font-bold">${finSummary.bankroll.toFixed(2)}</div>
                    <p className="text-xs text-gray-500 mt-2">Calculated as profit for selected period. Add opening balance logic later if needed.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-gray-600">Select a date range and click Run.</div>
            )}
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === "billing" && (
          <div className="bg-white rounded-xl shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Billing</h2>
                <p className="text-sm text-gray-500">Active invoices and open estimates</p>
              </div>
              <button onClick={loadBilling} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">Refresh</button>
            </div>

            {billingLoading ? (
              <div className="p-8 text-center text-gray-600">Loading…</div>
            ) : (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Invoices */}
                <div className="border rounded-lg">
                  <div className="px-4 py-3 border-b font-semibold">Active Invoices</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left border">Invoice</th>
                          <th className="px-4 py-2 text-left border">Customer</th>
                          <th className="px-4 py-2 text-right border">Total</th>
                          <th className="px-4 py-2 text-right border">Balance</th>
                          <th className="px-4 py-2 text-left border">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingInvoices.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No active invoices</td></tr>
                        ) : (
                          billingInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 border">{inv.id.slice(0,8).toUpperCase()}</td>
                              <td className="px-4 py-2 border">{inv.customer?.name || "—"}</td>
                              <td className="px-4 py-2 border text-right">${inv.total.toFixed(2)}</td>
                              <td className="px-4 py-2 border text-right">${inv.balance.toFixed(2)}</td>
                              <td className="px-4 py-2 border">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${inv.status === "PAID" ? "bg-green-100 text-green-700" : inv.status === "OVERDUE" ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"}`}>{inv.status}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Open Estimates */}
                <div className="border rounded-lg">
                  <div className="px-4 py-3 border-b font-semibold">Open Estimates</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left border">Job</th>
                          <th className="px-4 py-2 text-left border">Customer</th>
                          <th className="px-4 py-2 text-left border">Pricing</th>
                          <th className="px-4 py-2 text-right border">Estimate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingEstimates.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No open estimates</td></tr>
                        ) : (
                          billingEstimates.map((job) => (
                            <tr key={job.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 border">{job.title}</td>
                              <td className="px-4 py-2 border">{job.customer?.name || "—"}</td>
                              <td className="px-4 py-2 border">{job.pricingType === "T&M" ? "Time & Materials" : "Fixed"}</td>
                              <td className="px-4 py-2 border text-right">{job.estimatedPrice ? `$${job.estimatedPrice.toFixed(2)}` : "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">⚠️ Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this user? This will permanently remove:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1">
              <li>User account and profile</li>
              <li>All time entries</li>
              <li>Job assignments</li>
              <li>Activity history</li>
            </ul>
            <p className="text-red-600 font-semibold mb-6">This action cannot be undone!</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

