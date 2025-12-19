"use client";

import { useEffect, useState, useRef } from "react";
import { getAllUsersStats, getUserTimeEntries, getCurrentUserRole, updateTimeEntryTimes } from "./actions";
import Link from "next/link";
import { nowInCentral, formatDateShort, formatDateTime, formatDateInput, startOfDayCentral, endOfDayCentral } from "@/lib/date-utils";
import dayjs from "dayjs";
import PhotoViewerModal from "../qc/PhotoViewerModal";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  clockInNotes: string | null;
  notes: string | null;
  images: string | null;
  job: { id: string; title: string } | null;
}

interface UserStats {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: string;
  dateRangeHours: number;
  completedShifts: number;
  thisWeekHours: number;
  thisMonthHours: number;
  currentStatus?: "IDLE" | "WORKING" | "ON_BREAK";
  recentEntries: TimeEntry[];
}

export default function HRPage() {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false); // Separate loading state for filter updates
  const [error, setError] = useState<string | undefined>();
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [userEntries, setUserEntries] = useState<TimeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [showEntriesModal, setShowEntriesModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editBreakStart, setEditBreakStart] = useState("");
  const [editBreakEnd, setEditBreakEnd] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState<string | undefined>();
  const [editLoading, setEditLoading] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  
  // Helper function to get Saturday of current week in Central Time
  // Week runs Saturday (day 6) to Friday (day 5)
  const getSaturdayOfWeek = (date: dayjs.Dayjs): dayjs.Dayjs => {
    const day = date.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Calculate days to subtract to get to Saturday
    const daysToSubtract = day === 0 ? 1 : day === 6 ? 0 : day + 1;
    return date.subtract(daysToSubtract, 'day').startOf('day');
  };

  // Helper function to get Friday of the week (6 days after Saturday) in Central Time
  const getFridayOfWeek = (saturday: dayjs.Dayjs): dayjs.Dayjs => {
    return saturday.add(6, 'day').endOf('day');
  };

  // Date range state - default to this week (Saturday to Friday) in Central Time
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const now = nowInCentral();
    const saturday = getSaturdayOfWeek(now);
    return saturday.format('YYYY-MM-DD');
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    const now = nowInCentral();
    const saturday = getSaturdayOfWeek(now);
    const friday = getFridayOfWeek(saturday);
    return friday.format('YYYY-MM-DD');
  });

  // Track if this is the initial load using a ref (doesn't trigger re-renders)
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const loadRole = async () => {
      const res = await getCurrentUserRole();
      console.log("Current user role check:", res);
      if (res.ok && res.role === "ADMIN") {
        setIsAdmin(true);
        console.log("User is ADMIN - edit button should be visible");
      } else {
        console.log("User is not ADMIN - role:", res.role);
      }
    };
    loadRole();
  }, []);

  const loadData = async () => {
    // Use filterLoading for subsequent updates, full loading only for initial load
    const isInitial = isInitialLoadRef.current;
    if (isInitial) {
      setLoading(true);
      isInitialLoadRef.current = false; // Mark as no longer initial load
    } else {
      setFilterLoading(true);
    }
    setError(undefined);

    const res = await getAllUsersStats(dateFrom || undefined, dateTo || undefined);

    if (!res.ok) {
      setError(res.error);
      if (isInitial) {
        setLoading(false);
      } else {
        setFilterLoading(false);
      }
      return;
    }

    setUsers(res.users as any);
    if (isInitial) {
      setLoading(false);
    } else {
      setFilterLoading(false);
    }
  };

  const handleViewEntries = async (user: UserStats) => {
    setSelectedUser(user);
    setShowEntriesModal(true);
    setLoadingEntries(true);

    const res = await getUserTimeEntries(user.id);

    if (res.ok) {
      setUserEntries(res.entries as any);
    } else {
      setError(res.error);
    }

    setLoadingEntries(false);
  };

  const formatTime = (dateString: string) => {
    return formatDateTime(dateString).split(', ')[1] || formatDateTime(dateString);
  };

  const formatDate = (dateString: string) => {
    return formatDateShort(dateString);
  };

  const calculateDuration = (entry: TimeEntry) => {
    if (!entry.clockOut) return "In progress";
    
    const start = new Date(entry.clockIn);
    const end = new Date(entry.clockOut);
    const breakMs =
      entry.breakStart ? (entry.breakEnd ? new Date(entry.breakEnd).getTime() : end.getTime()) - new Date(entry.breakStart).getTime() : 0;
    const diff = end.getTime() - start.getTime() - Math.max(breakMs, 0);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const openEditModal = (entry: TimeEntry) => {
    try {
      // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
      const clockInDate = new Date(entry.clockIn);
      const clockOutDate = entry.clockOut ? new Date(entry.clockOut) : null;
      const breakStartDate = entry.breakStart ? new Date(entry.breakStart) : null;
      const breakEndDate = entry.breakEnd ? new Date(entry.breakEnd) : null;
      
      const formatForInput = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };
      
      setEditEntry(entry);
      setEditClockIn(formatForInput(clockInDate));
      setEditClockOut(clockOutDate ? formatForInput(clockOutDate) : "");
      setEditBreakStart(breakStartDate ? formatForInput(breakStartDate) : "");
      setEditBreakEnd(breakEndDate ? formatForInput(breakEndDate) : "");
      setEditPassword("");
      setEditError(undefined);
      setShowEditConfirm(true);
    } catch (err) {
      console.error("Error opening edit modal:", err);
      setEditError("Failed to open edit form. Please try again.");
    }
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    setEditLoading(true);
    setEditError(undefined);
    const res = await updateTimeEntryTimes(
      editEntry.id,
      new Date(editClockIn).toISOString(),
      editClockOut ? new Date(editClockOut).toISOString() : null,
      editBreakStart ? new Date(editBreakStart).toISOString() : null,
      editBreakEnd ? new Date(editBreakEnd).toISOString() : null,
      editPassword
    );
    if (!res.ok) {
      setEditError(res.error || "Failed to update entry");
      setEditLoading(false);
      return;
    }
    // refresh entries list
    if (selectedUser) {
      const refreshed = await getUserTimeEntries(selectedUser.id);
      if (refreshed.ok) {
        setUserEntries(refreshed.entries as any);
      }
    }
    setShowEditConfirm(false);
    setEditLoading(false);
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

  const getStatusBadge = (status?: "IDLE" | "WORKING" | "ON_BREAK") => {
    switch (status) {
      case "WORKING":
        return {
          label: "Working",
          className: "bg-green-100 text-green-700 border-green-200",
        };
      case "ON_BREAK":
        return {
          label: "On Break",
          className: "bg-orange-100 text-orange-700 border-orange-200",
        };
      default:
        return {
          label: "Idle",
          className: "bg-gray-100 text-gray-700 border-gray-200",
        };
    }
  };

  // Filter users based on search and role
  const filteredUsers = users.filter((user) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        (user.name || "").toLowerCase().includes(query) ||
        (user.email || "").toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Role filter
    if (roleFilter !== "ALL") {
      if (user.role !== roleFilter) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading HR data...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-black border-b-2 border-[#001f3f] shadow-lg sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">HR Management</h1>
            <p className="text-xs sm:text-sm text-gray-300">Employee time tracking and statistics</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-400 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px] flex items-center justify-center text-white"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 border border-gray-200 mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div className="flex-shrink-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">Date Range Filter</h2>
              <p className="text-xs sm:text-sm text-gray-500">Select a date range to calculate employee hours</p>
            </div>
            <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
                />
              </div>
              <div className="flex items-end w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const now = nowInCentral();
                    const saturday = getSaturdayOfWeek(now);
                    const friday = getFridayOfWeek(saturday);
                    setDateFrom(saturday.format('YYYY-MM-DD'));
                    setDateTo(friday.format('YYYY-MM-DD'));
                  }}
                  className="w-full lg:w-auto px-4 py-2.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px]"
                >
                  This Week (Sat-Fri)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 border border-gray-200">
            <div className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Total Employees</div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">
              {filterLoading ? (
                <span className="text-gray-400">...</span>
              ) : (
                users.length
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 border border-gray-200">
            <div className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Working Employees</div>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">
              {filterLoading ? (
                <span className="text-gray-400">...</span>
              ) : (
                users.filter((user) => user.currentStatus === "WORKING" || user.currentStatus === "ON_BREAK").length
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {filterLoading ? "" : (
                <>
                  {users.filter((u) => u.currentStatus === "WORKING").length} working,{" "}
                  {users.filter((u) => u.currentStatus === "ON_BREAK").length} on break
                </>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 border border-gray-200">
            <div className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Hours (Selected Range)</div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">
              {filterLoading ? (
                <span className="text-gray-400">...</span>
              ) : (
                `${users.reduce((sum, user) => sum + user.dateRangeHours, 0).toFixed(1)}h`
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 border border-gray-200">
            <div className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Completed Shifts</div>
            <div className="text-2xl sm:text-3xl font-bold text-purple-600">
              {filterLoading ? (
                <span className="text-gray-400">...</span>
              ) : (
                users.reduce((sum, user) => sum + user.completedShifts, 0)
              )}
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 border border-gray-200 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
              />
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="EMPLOYEE">Employee</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              {(searchQuery || roleFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setRoleFilter("ALL");
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 min-h-[44px]"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Employee List */}
        <div className="bg-white rounded-xl shadow border border-gray-200">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Employee Time Records
                {filteredUsers.length !== users.length && (
                  <span className="ml-2 text-xs sm:text-sm font-normal text-gray-500">
                    ({filteredUsers.length} of {users.length})
                  </span>
                )}
              </h2>
              {filterLoading && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Updating...</span>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden divide-y divide-gray-200">
            {filterLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Loading data...</span>
                </div>
              </div>
            )}
            {filteredUsers.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                {users.length === 0 
                  ? "No employees found" 
                  : "No employees match your search criteria"}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const statusBadge = getStatusBadge(user.currentStatus);
                return (
                  <div key={user.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {(user.name || "U").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">{user.name || "Unknown"}</div>
                          <div className="text-xs text-gray-500 truncate">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {user.role}
                        </span>
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                      <div>
                        <div className="text-xs text-gray-500">Hours</div>
                        <div className="text-sm font-semibold text-gray-900">{user.dateRangeHours.toFixed(1)}h</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Shifts</div>
                        <div className="text-sm font-semibold text-gray-900">{user.completedShifts}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewEntries(user)}
                      className="w-full min-h-[44px] px-4 py-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg font-medium transition-colors border border-blue-200"
                    >
                      View Details
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto relative">
            {filterLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Loading data...</span>
                </div>
              </div>
            )}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours (Selected Range)
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shifts
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-gray-500">
                      {users.length === 0 
                        ? "No employees found" 
                        : "No employees match your search criteria"}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const statusBadge = getStatusBadge(user.currentStatus);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-4">
                          <div className="flex items-center min-w-0">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-600 font-medium text-sm">
                                {(user.name || "U").charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-3 min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate break-words">{user.name || "Unknown"}</div>
                              <div className="text-sm text-gray-500 truncate break-all">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                          {user.dateRangeHours.toFixed(1)}h
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                          {user.completedShifts}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleViewEntries(user)}
                            className="px-3 py-2 sm:px-2 sm:py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg font-medium transition-colors min-h-[44px] sm:min-h-0"
                          >
                            View Details
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

      {/* Time Entries Modal */}
      {showEntriesModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 z-[1]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{selectedUser.name}'s Time Entries</h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Hours (Selected Range): {selectedUser.dateRangeHours.toFixed(1)}h across {selectedUser.completedShifts} shifts
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowEntriesModal(false);
                    setSelectedUser(null);
                    setUserEntries([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 active:text-gray-800 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
                  aria-label="Close modal"
                >
                  <span className="text-2xl sm:text-3xl">×</span>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {loadingEntries ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-500 text-sm">Loading entries...</p>
                </div>
              ) : userEntries.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No time entries found</p>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {userEntries.map((entry) => (
                    <div key={entry.id} className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm sm:text-base text-gray-900">
                            {formatDate(entry.clockIn)}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">
                            {formatTime(entry.clockIn)} - {entry.clockOut ? formatTime(entry.clockOut) : "In progress"}
                          </div>
                          {(entry as any).breakStart || (entry as any).breakEnd ? (
                            <div className="text-xs sm:text-sm text-gray-600 mt-1 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                              {(entry as any).breakStart && <span>Break start: {formatTime((entry as any).breakStart)}</span>}
                              {(entry as any).breakEnd && <span>Break end: {formatTime((entry as any).breakEnd)}</span>}
                              {(entry as any).breakStart && !(entry as any).breakEnd && <span className="text-orange-600 font-medium">On break</span>}
                            </div>
                          ) : null}
                        </div>
                            <div className="text-left sm:text-right flex flex-col items-start sm:items-end gap-2">
                          <div className="font-semibold text-sm sm:text-base text-blue-600">
                            {calculateDuration(entry)}
                          </div>
                              {isAdmin ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log("Edit time clicked for entry:", entry.id);
                                    openEditModal(entry);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 cursor-pointer"
                                >
                                  Edit time
                                </button>
                              ) : (
                                <span className="text-[11px] text-gray-400">Admin only</span>
                              )}
                        </div>
                      </div>
                      {entry.job && (
                        <div className="mt-2 text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Job: {entry.job.title}
                          </span>
                        </div>
                      )}
                      {entry.clockInNotes && (
                        <div className="mt-2 text-sm text-gray-600 bg-white rounded p-2 border border-gray-200">
                          <span className="font-medium text-blue-700">Clock In Description:</span>
                          <p className="mt-1 text-gray-700">{entry.clockInNotes}</p>
                        </div>
                      )}
                      {entry.notes && (
                        <div className="mt-2 text-sm text-gray-600 bg-white rounded p-2 border border-gray-200">
                          <span className="font-medium text-green-700">Clock Out Description:</span>
                          <p className="mt-1 text-gray-700">{entry.notes}</p>
                        </div>
                      )}
                      {entry.images && (() => {
                        try {
                          const images = JSON.parse(entry.images);
                          if (Array.isArray(images) && images.length > 0) {
                            return (
                              <div className="mt-2">
                                <p className="text-xs text-gray-500 mb-1.5 font-medium">
                                  {images.length} photo(s)
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                  {images.map((imgPath: string, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        setPhotoViewerPhotos(images);
                                        setPhotoViewerIndex(idx);
                                        setShowPhotoViewer(true);
                                      }}
                                      className="block w-16 h-16 sm:w-20 sm:h-20 rounded-lg border-2 border-gray-300 overflow-hidden hover:ring-2 hover:ring-blue-500 active:ring-blue-600 transition-all cursor-pointer touch-manipulation shadow-sm"
                                      aria-label={`View photo ${idx + 1}`}
                                    >
                                      <img
                                        src={imgPath}
                                        alt={`Photo ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                        } catch (e) {
                          return null;
                        }
                        return null;
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
              <button
                onClick={() => {
                  setShowEntriesModal(false);
                  setSelectedUser(null);
                  setUserEntries([]);
                }}
                className="w-full min-h-[44px] px-4 py-2.5 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 active:bg-gray-800 transition-colors font-medium touch-manipulation shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {showPhotoViewer && (
        <PhotoViewerModal
          photos={photoViewerPhotos}
          initialIndex={photoViewerIndex}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}

      {showEditConfirm && editEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Edit time entry</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clock in</label>
                <input
                  type="datetime-local"
                  value={editClockIn}
                  onChange={(e) => setEditClockIn(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clock out</label>
                <input
                  type="datetime-local"
                  value={editClockOut}
                  onChange={(e) => setEditClockOut(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px]"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty if still in progress.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Break start (optional)</label>
                <input
                  type="datetime-local"
                  value={editBreakStart}
                  onChange={(e) => setEditBreakStart(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px]"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty if no break was taken.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Break end (optional)</label>
                <input
                  type="datetime-local"
                  value={editBreakEnd}
                  onChange={(e) => setEditBreakEnd(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px]"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty if break is still ongoing.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin password (required)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px]"
                  placeholder="Enter your admin password"
                />
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={() => setShowEditConfirm(false)}
                disabled={editLoading}
                className="flex-1 min-h-[44px] px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editLoading}
                className="flex-1 min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300"
              >
                {editLoading ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

