"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getAllOrganizations,
  createOrganization,
  updateOrganization,
  toggleOrganizationStatus,
  deleteOrganization,
  getOrganizationUsers,
  createOrganizationAdmin,
  getSuperAdminDashboardStats,
  assignUserToOrganization,
  toggleUserStatus,
  deleteUserAsSuper,
  getAllUsersAcrossOrganizations,
} from "./actions";

interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    users: number;
    jobs: number;
    customers: number;
    invoices: number;
  };
}

interface OrgUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string | null;
  isVerified: boolean;
  organizationId: string | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  createdAt: Date;
  _count: {
    timeEntries: number;
    assignedJobs: number;
  };
}

interface DashboardStats {
  totalOrganizations: number;
  activeOrganizations: number;
  disabledOrganizations: number;
  totalUsers: number;
  totalJobs: number;
  totalInvoices: number;
  topOrganizations: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    _count: {
      users: number;
      jobs: number;
    };
  }[];
}

export default function SuperAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  // Modal states
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showEditOrgModal, setShowEditOrgModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [showAllUsersModal, setShowAllUsersModal] = useState(false);

  // Selected organization for modals
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [allUsers, setAllUsers] = useState<OrgUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form states
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Check if user is super admin
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orgsRes, statsRes] = await Promise.all([
        getAllOrganizations(),
        getSuperAdminDashboardStats(),
      ]);

      if (orgsRes.ok && 'organizations' in orgsRes) {
        setOrganizations(orgsRes.organizations);
      }
      if (statsRes.ok && 'stats' in statsRes) {
        setStats(statsRes.stats);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    
    if (!session?.user || !isSuperAdmin) {
      router.push("/dashboard");
      return;
    }

    fetchData();
  }, [session, status, isSuperAdmin, router, fetchData]);

  // Auto-generate slug from name
  useEffect(() => {
    if (orgName && !showEditOrgModal) {
      const slug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setOrgSlug(slug);
    }
  }, [orgName, showEditOrgModal]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const formData = new FormData();
    formData.append("name", orgName);
    formData.append("slug", orgSlug);

    const res = await createOrganization(formData);
    if (res.ok) {
      setSuccess("Organization created successfully");
      setShowCreateOrgModal(false);
      setOrgName("");
      setOrgSlug("");
      fetchData();
    } else {
      setError('error' in res ? res.error : 'Unknown error');
    }
  };

  const handleEditOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;

    setError(undefined);
    setSuccess(undefined);

    const formData = new FormData();
    formData.append("name", orgName);
    formData.append("slug", orgSlug);

    const res = await updateOrganization(selectedOrg.id, formData);
    if (res.ok) {
      setSuccess("Organization updated successfully");
      setShowEditOrgModal(false);
      setSelectedOrg(null);
      setOrgName("");
      setOrgSlug("");
      fetchData();
    } else {
      setError('error' in res ? res.error : 'Unknown error');
    }
  };

  const handleToggleOrgStatus = async (org: Organization) => {
    setError(undefined);
    setSuccess(undefined);

    const res = await toggleOrganizationStatus(org.id);
    if (res.ok) {
      setSuccess('message' in res ? res.message : 'Status updated successfully');
      fetchData();
    } else {
      setError('error' in res ? res.error : 'Unknown error');
    }
  };

  const handleDeleteOrg = async (org: Organization) => {
    if (!confirm(`Are you sure you want to delete "${org.name}"? This cannot be undone.`)) {
      return;
    }

    setError(undefined);
    setSuccess(undefined);

    const res = await deleteOrganization(org.id);
    if (res.ok) {
      setSuccess('message' in res ? res.message : 'Organization deleted successfully');
      fetchData();
    } else {
      setError('error' in res ? res.error : 'Unknown error');
    }
  };

  const handleViewUsers = async (org: Organization) => {
    setSelectedOrg(org);
    setLoadingUsers(true);
    setShowUsersModal(true);

    const res = await getOrganizationUsers(org.id);
    if (res.ok && 'users' in res && res.users) {
      setOrgUsers(res.users);
    }
    setLoadingUsers(false);
  };

  const handleViewAllUsers = async () => {
    setLoadingUsers(true);
    setShowAllUsersModal(true);

    const res = await getAllUsersAcrossOrganizations();
    if (res.ok && 'users' in res && res.users) {
      setAllUsers(res.users);
    }
    setLoadingUsers(false);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;

    setError(undefined);
    setSuccess(undefined);

    const formData = new FormData();
    formData.append("name", adminName);
    formData.append("email", adminEmail);
    formData.append("password", adminPassword);
    formData.append("organizationId", selectedOrg.id);

    const res = await createOrganizationAdmin(formData);
    if (res.ok) {
      setSuccess('message' in res ? res.message : 'Admin created successfully');
      setShowCreateAdminModal(false);
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      // Refresh users if viewing
      if (showUsersModal) {
        const usersRes = await getOrganizationUsers(selectedOrg.id);
        if (usersRes.ok && 'users' in usersRes && usersRes.users) {
          setOrgUsers(usersRes.users);
        }
      }
      fetchData();
    } else {
      setError('error' in res ? res.error : 'Unknown error');
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    setError(undefined);
    const res = await toggleUserStatus(userId);
    if (res.ok) {
      setSuccess('message' in res ? res.message : 'User status updated successfully');
      // Refresh the users list
      if (selectedOrg) {
        const usersRes = await getOrganizationUsers(selectedOrg.id);
        if (usersRes.ok && 'users' in usersRes && usersRes.users) {
          setOrgUsers(usersRes.users);
        }
      }
      if (showAllUsersModal) {
        const usersRes = await getAllUsersAcrossOrganizations();
        if (usersRes.ok && 'users' in usersRes && usersRes.users) {
          setAllUsers(usersRes.users);
        }
      }
    } else {
      setError('error' in res ? res.error : 'Unknown error');
    }
  };

  const openEditModal = (org: Organization) => {
    setSelectedOrg(org);
    setOrgName(org.name);
    setOrgSlug(org.slug);
    setShowEditOrgModal(true);
  };

  const openCreateAdminModal = (org: Organization) => {
    setSelectedOrg(org);
    setShowCreateAdminModal(true);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You don't have permission to access this page.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-indigo-600 hover:underline">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Super Admin Dashboard</h1>
              <p className="text-purple-200 mt-1">Manage all organizations and users</p>
            </div>
            <Link
              href="/dashboard"
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <p className="text-sm text-gray-500">Organizations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalOrganizations}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <p className="text-sm text-gray-500">Active Orgs</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeOrganizations}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <p className="text-sm text-gray-500">Disabled Orgs</p>
              <p className="text-2xl font-bold text-red-600">{stats.disabledOrganizations}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <p className="text-sm text-gray-500">Total Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalJobs}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <p className="text-sm text-gray-500">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setShowCreateOrgModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>➕</span> Create Organization
          </button>
          <button
            onClick={handleViewAllUsers}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>👥</span> View All Users
          </button>
        </div>

        {/* Organizations Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Organizations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-indigo-600 to-blue-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-black uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-black uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-black uppercase tracking-wider">
                    Jobs
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-black uppercase tracking-wider">
                    Customers
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-black uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{org.name}</p>
                      <p className="text-xs text-gray-500">
                        Created {org.createdAt.toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{org.slug}</code>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          org.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {org.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-medium">{org._count.users}</td>
                    <td className="px-6 py-4 text-center font-medium">{org._count.jobs}</td>
                    <td className="px-6 py-4 text-center font-medium">{org._count.customers}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleViewUsers(org)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          title="View Users"
                        >
                          👥
                        </button>
                        <button
                          onClick={() => openCreateAdminModal(org)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                          title="Add Admin"
                        >
                          ➕
                        </button>
                        <button
                          onClick={() => openEditModal(org)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleToggleOrgStatus(org)}
                          className={`text-sm font-medium ${
                            org.isActive
                              ? "text-yellow-600 hover:text-yellow-800"
                              : "text-green-600 hover:text-green-800"
                          }`}
                          title={org.isActive ? "Disable" : "Enable"}
                        >
                          {org.isActive ? "🔒" : "🔓"}
                        </button>
                        <button
                          onClick={() => handleDeleteOrg(org)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {organizations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No organizations found. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Organization Modal */}
      {showCreateOrgModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Create Organization</h3>
            </div>
            <form onSubmit={handleCreateOrg} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Acme Corporation"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="acme-corporation"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateOrgModal(false);
                    setOrgName("");
                    setOrgSlug("");
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      {showEditOrgModal && selectedOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Edit Organization</h3>
            </div>
            <form onSubmit={handleEditOrg} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditOrgModal(false);
                    setSelectedOrg(null);
                    setOrgName("");
                    setOrgSlug("");
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Organization Users Modal */}
      {showUsersModal && selectedOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Users in {selectedOrg.name}</h3>
                <p className="text-sm text-gray-500">{orgUsers.length} users</p>
              </div>
              <button
                onClick={() => openCreateAdminModal(selectedOrg)}
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700"
              >
                + Add Admin
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {loadingUsers ? (
                <div className="p-8 text-center text-gray-500">Loading users...</div>
              ) : orgUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No users in this organization</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        User
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Role
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Jobs
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orgUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{user.name || "—"}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.role === "ADMIN"
                                ? "bg-red-100 text-red-700"
                                : user.role === "MANAGER"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.status === "APPROVED"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {user.status || "APPROVED"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {user._count.assignedJobs}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleToggleUserStatus(user.id)}
                            className={`text-sm mr-2 ${
                              user.status === "APPROVED"
                                ? "text-yellow-600 hover:text-yellow-800"
                                : "text-green-600 hover:text-green-800"
                            }`}
                            title={user.status === "APPROVED" ? "Disable" : "Enable"}
                          >
                            {user.status === "APPROVED" ? "🔒" : "🔓"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowUsersModal(false);
                  setSelectedOrg(null);
                  setOrgUsers([]);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Users Modal */}
      {showAllUsersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">All Users Across Organizations</h3>
              <p className="text-sm text-gray-500">{allUsers.length} total users</p>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {loadingUsers ? (
                <div className="p-8 text-center text-gray-500">Loading users...</div>
              ) : allUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No users found</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Organization
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Role
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{user.name || "—"}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          {user.organization ? (
                            <span className="text-sm text-gray-900">{user.organization.name}</span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">No Organization</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.role === "ADMIN"
                                ? "bg-red-100 text-red-700"
                                : user.role === "MANAGER"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.status === "APPROVED"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {user.status || "APPROVED"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleToggleUserStatus(user.id)}
                            className={`text-sm ${
                              user.status === "APPROVED"
                                ? "text-yellow-600 hover:text-yellow-800"
                                : "text-green-600 hover:text-green-800"
                            }`}
                            title={user.status === "APPROVED" ? "Disable" : "Enable"}
                          >
                            {user.status === "APPROVED" ? "🔒" : "🔓"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowAllUsersModal(false);
                  setAllUsers([]);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateAdminModal && selectedOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Create Admin for {selectedOrg.name}</h3>
            </div>
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="admin@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateAdminModal(false);
                    setAdminName("");
                    setAdminEmail("");
                    setAdminPassword("");
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

