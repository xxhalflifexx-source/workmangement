"use client";

import { useEffect, useState } from "react";
import { clockIn, clockOut, getCurrentStatus, getTodayEntries, getRecentEntries, getAvailableJobs, getAssignedJobs } from "./actions";
import Link from "next/link";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  notes: string | null;
  images: string | null;
  job: { title: string; id: string } | null;
}

interface Job {
  id: string;
  title: string;
  status: string;
  priority: string;
}

interface AssignedJob {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
}

export default function TimeClockPage() {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<AssignedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [elapsedTime, setElapsedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }));
      setCurrentDate(now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isClockedIn || !currentEntry) return;

    const interval = setInterval(() => {
      const start = new Date(currentEntry.clockIn).getTime();
      const now = new Date().getTime();
      const diff = now - start;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isClockedIn, currentEntry]);

  const loadData = async () => {
    setLoading(true);
    setError(undefined);
    setSuccess(undefined);

    const [statusRes, todayRes, recentRes, jobsRes, assignedRes] = await Promise.all([
      getCurrentStatus(),
      getTodayEntries(),
      getRecentEntries(10),
      getAvailableJobs(),
      getAssignedJobs(),
    ]);

    if (statusRes.ok && statusRes.activeEntry) {
      setIsClockedIn(true);
      setCurrentEntry(statusRes.activeEntry as any);
      setSelectedJobId(statusRes.activeEntry.jobId || "");
    } else {
      setIsClockedIn(false);
      setCurrentEntry(null);
      setSelectedJobId("");
    }

    if (todayRes.ok) {
      setTodayEntries(todayRes.entries as any);
    } else {
      setError(todayRes.error);
    }

    if (recentRes.ok) {
      setRecentEntries(recentRes.entries as any);
    } else {
      setError(recentRes.error);
    }

    if (jobsRes.ok && jobsRes.jobs) {
      setAvailableJobs(jobsRes.jobs);
    } else {
      setError(jobsRes.error || "Failed to load jobs");
    }

    if (assignedRes.ok && assignedRes.jobs) {
      setAssignedJobs(assignedRes.jobs as any);
    } else {
      setError(assignedRes.error || "Failed to load assigned jobs");
    }

    setLoading(false);
  };

  const handleClockIn = async () => {
    setLoading(true);
    setError(undefined);
    setSuccess(undefined);

    try {
      const res = await clockIn(selectedJobId || undefined);

      if (!res.ok) {
        setError(res.error || "Failed to clock in");
        return;
      }

      setSuccess(
        selectedJobId
          ? "Clocked in successfully to job!"
          : "Clocked in successfully!"
      );
      setSelectedJobId("");
      await loadData();
    } catch (err: any) {
      console.error("Clock in error:", err);
      setError(err?.message || "Something went wrong while clocking in.");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setError(undefined);
    setSuccess(undefined);

    try {
      const res = await clockOut(notes);

      if (!res.ok) {
        setError(res.error || "Failed to clock out");
        return;
      }

      setSuccess("Clocked out successfully!");
      setNotes("");
      await loadData();
    } catch (err: any) {
      console.error("Clock out error:", err);
      setError(err?.message || "Something went wrong while clocking out.");
    } finally {
      setLoading(false);
    }
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

  const calculateTodayTotal = () => {
    let totalMs = 0;
    todayEntries.forEach((entry) => {
      if (entry.clockIn && entry.clockOut) {
        totalMs +=
          new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime();
      }
    });

    const totalHours = Math.floor(totalMs / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${totalHours}h ${totalMinutes}m`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Time Clock</h1>
              <p className="text-sm text-gray-500">Track your work hours</p>
            </div>
            <div className="hidden sm:block border-l border-gray-300 pl-6">
              <div className="text-sm text-gray-500">{currentDate || "Loading..."}</div>
              <div className="text-xl font-bold text-gray-900 font-mono">
                {currentTime || "Loading..."}
              </div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-5 py-8">
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

        {assignedJobs.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Your Assigned Jobs
              </h2>
              <span className="text-sm bg-blue-600 text-white px-3 py-1 rounded-full font-medium">
                {assignedJobs.length} active
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 flex-1">{job.title}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        job.priority === "URGENT"
                          ? "bg-red-100 text-red-700"
                          : job.priority === "HIGH"
                          ? "bg-orange-100 text-orange-700"
                          : job.priority === "MEDIUM"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {job.priority}
                    </span>
                  </div>
                  {job.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {job.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className={`${
                      job.status === "IN_PROGRESS"
                        ? "text-blue-600 font-medium"
                        : "text-gray-500"
                    }`}>
                      {job.status === "IN_PROGRESS" ? "In Progress" : "Pending"}
                    </span>
                    {job.dueDate && (
                      <span className="text-gray-600">
                        Due: {new Date(job.dueDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  {selectedJobId === job.id && !isClockedIn && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <span className="text-xs text-blue-600 font-medium">
                        ✓ Selected for clock in
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-4 italic">
              Click a job to select it for clock in
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
              <div className="text-center mb-8">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4 ${
                  isClockedIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                }`}>
                  <div className={`w-2 h-2 rounded-full ${isClockedIn ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                  {isClockedIn ? "Clocked In" : "Clocked Out"}
                </div>

                {isClockedIn && elapsedTime && (
                  <div className="mb-6">
                    <div className="text-6xl font-bold text-gray-900 font-mono tracking-tight">
                      {elapsedTime}
                    </div>
                    <p className="text-gray-500 text-sm mt-2">
                      Since {currentEntry && formatTime(currentEntry.clockIn)}
                      {currentEntry?.job && (
                        <span className="block mt-1 font-medium text-blue-600">
                          Working on: {currentEntry.job.title}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {!isClockedIn && (
                  <div className="mb-6">
                    <div className="text-5xl mb-2">⏰</div>
                    <p className="text-gray-600">Ready to start your shift?</p>
                  </div>
                )}
              </div>

              {!isClockedIn && (
                <div className="space-y-4">
                  {availableJobs.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Job (Optional)
                      </label>
                      <select
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-700"
                      >
                        <option value="">No specific job</option>
                        {availableJobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title} ({job.priority})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={handleClockIn}
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
                  >
                    {loading ? "Processing..." : "Clock In"}
                  </button>
                </div>
              )}

              {isClockedIn && (
                <div className="space-y-4">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about your shift (optional)"
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none"
                    rows={3}
                  />

                  <button
                    onClick={handleClockOut}
                    disabled={loading}
                    className="w-full bg-red-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
                  >
                    {loading ? "Processing..." : "Clock Out"}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 bg-white rounded-xl shadow p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Entries</h3>
              {todayEntries.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No entries for today yet</p>
              ) : (
                <div className="space-y-3">
                  {todayEntries.map((entry) => {
                    const images = entry.images ? JSON.parse(entry.images) : [];
                    return (
                      <div
                        key={entry.id}
                        className="p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {formatTime(entry.clockIn)} - {entry.clockOut ? formatTime(entry.clockOut) : "In progress"}
                            </p>
                            {entry.job && (
                              <p className="text-xs text-blue-600 mt-1">
                                {entry.job.title}
                              </p>
                            )}
                            {entry.notes && (
                              <p className="text-xs text-gray-600 mt-1">{entry.notes}</p>
                            )}
                            {images.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-500 mb-1">
                                  {images.length} photo(s)
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                  {images.map((imgPath: string, idx: number) => (
                                    <a
                                      key={idx}
                                      href={imgPath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block w-16 h-16 rounded border border-gray-300 overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
                                    >
                                      <img
                                        src={imgPath}
                                        alt={`Photo ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-blue-600 ml-4">
                            {calculateDuration(entry)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
              <div className="text-sm font-medium text-blue-100 mb-2">Today's Total</div>
              <div className="text-4xl font-bold mb-1">{calculateTodayTotal()}</div>
              <div className="text-sm text-blue-100">
                {todayEntries.filter(e => e.clockOut).length} completed shifts
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex justify-between">
                  <span>Total Shifts Today:</span>
                  <span className="font-medium">{todayEntries.length}</span>
                </li>
                <li className="flex justify-between">
                  <span>Active Shift:</span>
                  <span className="font-medium">{isClockedIn ? "Yes" : "No"}</span>
                </li>
                {currentEntry?.job && (
                  <li className="flex justify-between">
                    <span>Current Job:</span>
                    <span className="font-medium text-blue-600">{currentEntry.job.title}</span>
                  </li>
                )}
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent History</h3>
              {recentEntries.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No recent entries</p>
              ) : (
                <div className="space-y-3">
                  {recentEntries.map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(entry.clockIn)}
                        </p>
                        {entry.job && (
                          <p className="text-xs text-blue-600 mt-1">
                            {entry.job.title}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 ml-4">
                        {calculateDuration(entry)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
