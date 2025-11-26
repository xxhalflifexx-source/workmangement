"use client";

import { useEffect, useState, useRef } from "react";
import { getAllUsersStats, getUserTimeEntries } from "./actions";
import Link from "next/link";
import { nowInCentral, formatDateShort, formatDateTime, formatDateInput, startOfDayCentral, endOfDayCentral } from "@/lib/date-utils";
import dayjs from "dayjs";
import PhotoViewerModal from "../qc/PhotoViewerModal";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
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
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">HR Management</h1>
            <p className="text-sm text-gray-500">Employee time tracking and statistics</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/handbook"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              📖 Employee Handbook
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium whitespace-nowrap"
            >
              Back to Dashboard
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
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
            <div className="flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Date Range Filter</h2>
              <p className="text-sm text-gray-500">Select a date range to calculate employee hours</p>
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    const now = nowInCentral();
                    const saturday = getSaturdayOfWeek(now);
                    const friday = getFridayOfWeek(saturday);
                    setDateFrom(saturday.format('YYYY-MM-DD'));
                    setDateTo(friday.format('YYYY-MM-DD'));
                  }}
                  className="w-full lg:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  This Week (Sat-Fri)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="text-sm font-medium text-gray-500 mb-1">Total Employees</div>
            <div className="text-3xl font-bold text-gray-900">
              {filterLoading ? (
                <span className="text-gray-400">...</span>
              ) : (
                users.length
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="text-sm font-medium text-gray-500 mb-1">Hours (Selected Range)</div>
            <div className="text-3xl font-bold text-blue-600">
              {filterLoading ? (
                <span className="text-gray-400">...</span>
              ) : (
                `${users.reduce((sum, user) => sum + user.dateRangeHours, 0).toFixed(1)}h`
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="text-sm font-medium text-gray-500 mb-1">Completed Shifts</div>
            <div className="text-3xl font-bold text-green-600">
              {filterLoading ? (
                <span className="text-gray-400">...</span>
              ) : (
                users.reduce((sum, user) => sum + user.completedShifts, 0)
              )}
            </div>
          </div>
        </div>

        {/* Employee List */}
        <div className="bg-white rounded-xl shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Employee Time Records</h2>
              {filterLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Updating...</span>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto relative">
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
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-6 py-8 text-center text-gray-500">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center min-w-0">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {(user.name || "U").charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{user.name || "Unknown"}</div>
                            <div className="text-sm text-gray-500 truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {user.role}
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
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Time Entries Modal */}
      {showEntriesModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedUser.name}'s Time Entries</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Hours (Selected Range): {selectedUser.dateRangeHours.toFixed(1)}h across {selectedUser.completedShifts} shifts
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowEntriesModal(false);
                    setSelectedUser(null);
                    setUserEntries([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {loadingEntries ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-500 text-sm">Loading entries...</p>
                </div>
              ) : userEntries.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No time entries found</p>
              ) : (
                <div className="space-y-4">
                  {userEntries.map((entry) => (
                    <div key={entry.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium text-gray-900">
                            {formatDate(entry.clockIn)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatTime(entry.clockIn)} - {entry.clockOut ? formatTime(entry.clockOut) : "In progress"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-blue-600">
                            {calculateDuration(entry)}
                          </div>
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
                                <p className="text-xs text-gray-500 mb-1">
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
                                      className="block w-16 h-16 rounded border border-gray-300 overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
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

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setShowEntriesModal(false);
                  setSelectedUser(null);
                  setUserEntries([]);
                }}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
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
    </main>
  );
}

