"use client";

import { useEffect, useState } from "react";
import { clockIn, clockOut, getCurrentStatus, getTodayEntries, getRecentEntries, getAvailableJobs, getAssignedJobs, startBreak, endBreak } from "./actions";
import Link from "next/link";
import { nowInCentral, formatCentralTime, formatDateShort } from "@/lib/date-utils";
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
  const [clockInDescription, setClockInDescription] = useState("");
  const [descriptionError, setDescriptionError] = useState<string | undefined>();
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const [clockOutPhotos, setClockOutPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = nowInCentral();
      setCurrentTime(now.format("hh:mm:ss A"));
      setCurrentDate(now.format("ddd, MMM DD, YYYY"));
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
      // Both times are in UTC from database, calculate difference directly
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

    try {
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
    } catch (err: any) {
      console.error("Load data error:", err);
      setError(err?.message || "Failed to load time clock data.");
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setError(undefined);
    setSuccess(undefined);
    setDescriptionError(undefined);

    // Validation: If no job is selected, description is mandatory
    if (!selectedJobId && !clockInDescription.trim()) {
      setDescriptionError("Please provide a description before clocking in.");
      return;
    }

    setLoading(true);

    try {
      const res = await clockIn(selectedJobId || undefined, clockInDescription.trim() || undefined);

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
      setClockInDescription("");
      await loadData();
    } catch (err: any) {
      console.error("Clock in error:", err);
      setError(err?.message || "Something went wrong while clocking in.");
    } finally {
    setLoading(false);
    }
  };

  const handleClockOutClick = () => {
    setShowClockOutConfirm(true);
  };

  const handleStartBreak = async () => {
    setError(undefined);
    setSuccess(undefined);
    setLoading(true);
    try {
      const res = await startBreak();
      if (!res.ok) {
        setError(res.error || "Failed to start break");
      } else {
        await loadData();
        setSuccess("Break started");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to start break");
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setError(undefined);
    setSuccess(undefined);
    setLoading(true);
    try {
      const res = await endBreak();
      if (!res.ok) {
        setError(res.error || "Failed to end break");
      } else {
        await loadData();
        setSuccess("Break ended");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to end break");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOutConfirm = async () => {
    setLoading(true);
    setUploadingPhotos(true);
    setError(undefined);
    setSuccess(undefined);

    try {
      // Upload photos first if any
      let imagePaths: string[] = [];
      if (clockOutPhotos.length > 0) {
        const uploadFormData = new FormData();
        clockOutPhotos.forEach((file) => {
          uploadFormData.append("files", file);
        });

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json().catch(() => ({}));
          setError(errorData.error || "Failed to upload photos. Please try again.");
          setLoading(false);
          setUploadingPhotos(false);
          return;
        }

        const uploadData = await uploadRes.json();
        imagePaths = uploadData.paths || [];
      }

      // Clock out with notes and photos
      const formData = new FormData();
      formData.append("notes", notes);
      if (imagePaths.length > 0) {
        formData.append("imagePaths", JSON.stringify(imagePaths));
      }

      const res = await clockOut(formData);

      if (!res.ok) {
        setError(res.error || "Failed to clock out");
        return;
      }

      setSuccess("Clocked out successfully!");
      setNotes("");
      setClockOutPhotos([]);
      setShowClockOutConfirm(false);
      await loadData();
    } catch (err: any) {
      console.error("Clock out error:", err);
      setError(err?.message || "Something went wrong while clocking out.");
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
    }
  };

  const handleClockOutCancel = () => {
    setShowClockOutConfirm(false);
    setClockOutPhotos([]);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setClockOutPhotos((prev) => [...prev, ...files]);
    }
  };

  const removePhoto = (index: number) => {
    setClockOutPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const openPhotoViewer = (photos: string[], index: number) => {
    setPhotoViewerPhotos(photos);
    setPhotoViewerIndex(index);
    setShowPhotoViewer(true);
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
    return formatDateShort(dateString);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Time Clock</h1>
              <p className="text-xs sm:text-sm text-gray-500">Track your work hours</p>
            </div>
            <div className="sm:border-l sm:border-gray-300 sm:pl-6 w-full sm:w-auto">
              <div className="text-xs sm:text-sm text-gray-500">{currentDate || "Loading..."}</div>
              <div className="text-lg sm:text-xl font-bold text-gray-900 font-mono">
                {currentTime || "Loading..."}
              </div>
            </div>
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
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                Your Assigned Jobs
              </h2>
              <span className="text-xs sm:text-sm bg-blue-600 text-white px-3 py-1 rounded-full font-medium">
                {assignedJobs.length} active
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2 break-words" title={job.description || undefined}>
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
                        Due: {formatDateShort(job.dueDate || "")}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 border border-gray-200">
              <div className="text-center mb-8">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4 ${
                  isClockedIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                }`}>
                  <div className={`w-2 h-2 rounded-full ${isClockedIn ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                  {isClockedIn ? "Clocked In" : "Clocked Out"}
                </div>

                {isClockedIn && elapsedTime && (
                  <div className="mb-6">
                    <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 font-mono tracking-tight">
                      {elapsedTime}
                    </div>
                    <p className="text-gray-500 text-sm mt-2">
                      Since {currentEntry && formatTime(currentEntry.clockIn)}
                      {currentEntry?.job && (
                        <span className="block mt-1 font-medium text-blue-600">
                          Working on: {currentEntry.job.title}
                        </span>
                      )}
                      {currentEntry?.breakStart && !currentEntry?.breakEnd && (
                        <span className="block mt-1 font-medium text-orange-600">
                          On break since {formatTime(currentEntry.breakStart)}
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
                        onChange={(e) => {
                          setSelectedJobId(e.target.value);
                          // Clear description error when job is selected
                          if (e.target.value) {
                            setDescriptionError(undefined);
                          } else {
                            // If job is deselected, description becomes mandatory again
                            if (!clockInDescription.trim()) {
                              setDescriptionError(undefined); // Clear error, will show on submit
                            }
                          }
                        }}
                        className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-gray-700 text-sm sm:text-base"
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
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description {!selectedJobId && <span className="text-red-500">*</span>}
                      {selectedJobId && <span className="text-gray-500 text-xs font-normal">(Optional)</span>}
                    </label>
                    <textarea
                      value={clockInDescription}
                      onChange={(e) => {
                        setClockInDescription(e.target.value);
                        // Clear error when user starts typing
                        if (descriptionError && e.target.value.trim()) {
                          setDescriptionError(undefined);
                        }
                      }}
                      placeholder={selectedJobId ? "Add a description (optional)" : "Please provide a description of what you'll be working on"}
                      className={`w-full min-h-[44px] border rounded-lg px-3 py-2 text-sm resize-none ${
                        descriptionError 
                          ? "border-red-300 bg-red-50" 
                          : "border-gray-300"
                      }`}
                      rows={3}
                      required={!selectedJobId}
                    />
                    {descriptionError && (
                      <p className="mt-1 text-sm text-red-600">{descriptionError}</p>
                    )}
                    {!selectedJobId && (
                      <p className="mt-1 text-xs text-gray-500">
                        A description is required when clocking in without selecting a job.
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleClockIn}
                    disabled={loading}
                    className="w-full min-h-[44px] bg-green-600 text-white py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
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
                    className="w-full min-h-[44px] border border-gray-300 rounded-lg p-3 text-sm resize-none"
                    rows={3}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={handleStartBreak}
                      disabled={loading || !!currentEntry?.breakStart && !currentEntry?.breakEnd}
                      className="min-h-[44px] w-full bg-white border border-gray-300 text-gray-800 py-3 rounded-xl font-semibold text-sm sm:text-base hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed shadow-sm"
                    >
                      Start Break
                    </button>
                    <button
                      onClick={handleEndBreak}
                      disabled={loading || !currentEntry?.breakStart || !!currentEntry?.breakEnd}
                      className="min-h-[44px] w-full bg-white border border-gray-300 text-gray-800 py-3 rounded-xl font-semibold text-sm sm:text-base hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed shadow-sm"
                    >
                      End Break
                    </button>
                    <button
                      onClick={handleClockOutClick}
                      disabled={loading}
                      className="min-h-[44px] w-full bg-red-600 text-white py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
                    >
                      {loading ? "Processing..." : "Clock Out"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 bg-white rounded-xl shadow p-4 sm:p-6 border border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Today's Entries</h3>
              {todayEntries.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No entries for today yet</p>
              ) : (
                <div className="space-y-3">
                  {todayEntries.map((entry) => {
                    const images = entry.images ? JSON.parse(entry.images) : [];
                    return (
                      <div
                        key={entry.id}
                        className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm sm:text-base font-medium text-gray-900">
                              {formatTime(entry.clockIn)} - {entry.clockOut ? formatTime(entry.clockOut) : "In progress"}
                            </p>
                            {entry.job && (
                              <p className="text-xs sm:text-sm text-blue-600 mt-1 break-words">
                                {entry.job.title}
                              </p>
                            )}
                            {entry.clockInNotes && (
                              <p className="text-xs sm:text-sm text-gray-600 mt-1.5 break-words">
                                <span className="font-medium text-blue-700">Clock In:</span> {entry.clockInNotes}
                              </p>
                            )}
                            {entry.notes && (
                              <p className="text-xs sm:text-sm text-gray-600 mt-1.5 break-words">
                                <span className="font-medium text-green-700">Clock Out:</span> {entry.notes}
                              </p>
                            )}
                            {images.length > 0 && (
                              <div className="mt-2 sm:mt-3">
                                <p className="text-xs text-gray-500 mb-1.5 font-medium">
                                  {images.length} photo(s)
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                  {images.map((imgPath: string, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() => openPhotoViewer(images, idx)}
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
                            )}
                          </div>
                          <div className="text-sm sm:text-base font-semibold text-blue-600 sm:ml-4 flex-shrink-0">
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
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-4 sm:p-6 text-white">
              <div className="text-xs sm:text-sm font-medium text-blue-100 mb-2">Today's Total</div>
              <div className="text-3xl sm:text-4xl font-bold mb-1">{calculateTodayTotal()}</div>
              <div className="text-sm text-blue-100">
                {todayEntries.filter(e => e.clockOut).length} completed shifts
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-4 sm:p-6 border border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Stats</h3>
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

            <div className="bg-white rounded-xl shadow p-4 sm:p-6 border border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Recent History</h3>
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

      {/* Clock Out Confirmation Modal */}
      {showClockOutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 max-w-md w-full my-2 sm:my-4 max-h-[95vh] overflow-y-auto">
            <div className="text-center mb-4 sm:mb-6">
              <div className="mx-auto flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-red-100 mb-3 sm:mb-4">
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
                Confirm Clock Out
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 break-words px-2">
                {currentEntry?.job 
                  ? `Clock out from "${currentEntry.job.title}"?`
                  : "Are you sure you want to clock out?"}
              </p>
            </div>

            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              {/* Notes */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about your shift..."
                  className="w-full min-h-[44px] border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Photos (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="clock-out-photos"
                />
                <label
                  htmlFor="clock-out-photos"
                  className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px] w-full sm:w-auto touch-manipulation"
                >
                  <span className="text-base">📷</span>
                  <span>Choose Photos</span>
                </label>

                {clockOutPhotos.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-600 font-medium">
                      {clockOutPhotos.length} photo(s) selected
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2 max-h-[200px] sm:max-h-none overflow-y-auto">
                      {clockOutPhotos.map((file, index) => (
                        <div
                          key={index}
                          className="relative bg-gray-100 border border-gray-200 rounded-lg p-1.5 sm:p-2 aspect-square"
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover rounded"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            type="button"
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center text-sm sm:text-xs hover:bg-red-600 active:bg-red-700 touch-manipulation shadow-md"
                            aria-label={`Remove photo ${index + 1}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleClockOutCancel}
                disabled={loading || uploadingPhotos}
                className="flex-1 min-h-[44px] px-4 py-2.5 sm:py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={handleClockOutConfirm}
                disabled={loading || uploadingPhotos}
                className="flex-1 min-h-[44px] px-4 py-2.5 sm:py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 active:bg-red-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed touch-manipulation shadow-md"
              >
                {uploadingPhotos ? "Uploading..." : loading ? "Processing..." : "Yes, Clock Out"}
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
