"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDateShort } from "@/lib/date-utils";
import PhotoViewerModal from "../qc/PhotoViewerModal";

type TimeEntry = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  durationHours: number | null;
  clockInNotes: string | null;
  notes: string | null;
  images: string | null;
  jobTitle: string | null;
  isRework: boolean;
};

type Props = {
  entries: TimeEntry[];
  userName: string;
};

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getDuration(entry: TimeEntry) {
  const start = new Date(entry.clockIn).getTime();
  const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
  const diffMs = Math.max(end - start, 0);

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes, label: `${hours}h ${minutes}m` };
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function TimeRecordsClient({ entries, userName }: Props) {
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  }, []);

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(defaultStart);
  const [to, setTo] = useState(toISODate(new Date()));
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "longest" | "shortest">("newest");
  const [quickRange, setQuickRange] = useState<"7" | "30" | "month" | "all">("30");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<TimeEntry | null>(null);

  const openViewer = (photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const getImages = (entry: TimeEntry) => {
    if (!entry.images) return [];
    try {
      const parsed = JSON.parse(entry.images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const filtered = useMemo(() => {
    return entries
      .filter((entry) => {
        const date = toISODate(new Date(entry.clockIn));
        const afterStart = !from || date >= from;
        const beforeEnd = !to || date <= to;
        const term = search.toLowerCase();
        const matchesTerm =
          !term ||
          (entry.jobTitle && entry.jobTitle.toLowerCase().includes(term)) ||
          (entry.clockInNotes && entry.clockInNotes.toLowerCase().includes(term)) ||
          (entry.notes && entry.notes.toLowerCase().includes(term));
        return afterStart && beforeEnd && matchesTerm;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime();
        if (sortBy === "oldest") return new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime();
        const durA = getDuration(a);
        const durB = getDuration(b);
        const minutesA = durA.hours * 60 + durA.minutes;
        const minutesB = durB.hours * 60 + durB.minutes;
        if (sortBy === "longest") return minutesB - minutesA;
        return minutesA - minutesB; // shortest
      });
  }, [entries, from, to, search, sortBy]);

  const totals = useMemo(() => {
    let totalMinutes = 0;
    let completed = 0;
    let inProgress = 0;
    let reworkMinutes = 0;

    filtered.forEach((e) => {
      const { hours, minutes } = getDuration(e);
      const minutesTotal = hours * 60 + minutes;
      totalMinutes += minutesTotal;
      if (e.clockOut) {
        completed += 1;
      } else {
        inProgress += 1;
      }
      if (e.isRework) {
        reworkMinutes += minutesTotal;
      }
    });

    return {
      totalHours: (totalMinutes / 60).toFixed(1),
      totalShifts: filtered.length,
      completed,
      inProgress,
      reworkHours: (reworkMinutes / 60).toFixed(1),
    };
  }, [filtered]);

  const applyQuickRange = (range: "7" | "30" | "month" | "all") => {
    const today = new Date();
    setQuickRange(range);

    if (range === "all") {
      setFrom("");
      setTo("");
      return;
    }

    if (range === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFrom(toISODate(start));
      setTo(toISODate(today));
      return;
    }

    const days = range === "7" ? 7 : 30;
    const start = new Date();
    start.setDate(start.getDate() - days);
    setFrom(toISODate(start));
    setTo(toISODate(today));
  };

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8 bg-gray-50">
      <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs sm:text-sm text-gray-500">Welcome back</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Time Records</h1>
          <p className="text-sm text-gray-600 mt-1">Viewing your own clock-ins and hours</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px] bg-white shadow-sm"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: "Total hours", value: `${totals.totalHours}h`, sub: "Filtered range" },
          { label: "Shifts", value: totals.totalShifts.toString(), sub: `Completed: ${totals.completed}` },
          { label: "In progress", value: totals.inProgress.toString(), sub: "Live shifts" },
          { label: "Rework hours", value: `${totals.reworkHours}h`, sub: "Time on rework jobs" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm flex flex-col gap-1.5"
          >
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 lg:gap-6 mb-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Job title or notes"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[40px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[40px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[40px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[40px]"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="longest">Longest duration</option>
                <option value="shortest">Shortest duration</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "7", label: "Last 7 days" },
              { key: "30", label: "Last 30 days" },
              { key: "month", label: "This month" },
              { key: "all", label: "All time" },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => applyQuickRange(btn.key as any)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                  quickRange === btn.key
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-200"
                } min-h-[36px] transition-colors`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 sm:hidden">
          {filtered.length === 0 && (
            <div className="px-4 py-4 text-center text-gray-500 border border-gray-200 rounded-lg">
              No records found for this range.
            </div>
          )}
          {filtered.map((entry) => {
            const duration = getDuration(entry);
            const images = getImages(entry);
            return (
              <div key={entry.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{formatDateShort(entry.clockIn)}</p>
                    <p className="text-xs text-gray-500">{formatTime(entry.clockIn)} {entry.clockOut ? `- ${formatTime(entry.clockOut)}` : ""}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
                      entry.clockOut
                        ? "text-gray-700 bg-gray-50 border-gray-200"
                        : "text-yellow-700 bg-yellow-50 border-yellow-200"
                    }`}
                  >
                    {entry.clockOut ? "Completed" : "In progress"}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{entry.jobTitle || "General task"}</p>
                  {entry.clockInNotes && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{entry.clockInNotes}</p>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm text-gray-800">
                  <span className="font-semibold">{duration.label}</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border ${
                      entry.isRework
                        ? "text-purple-700 bg-purple-50 border-purple-200"
                        : "text-blue-700 bg-blue-50 border-blue-200"
                    }`}
                  >
                    {entry.isRework ? "Rework" : "Standard"}
                  </span>
                </div>
                <div className="space-y-1 border-t border-gray-100 pt-2">
                  {entry.clockInNotes && (
                    <p className="text-xs text-gray-800">
                      <span className="font-semibold text-gray-900">Clock-in:</span>{" "}
                      <span className="line-clamp-3">{entry.clockInNotes}</span>
                    </p>
                  )}
                  {entry.notes && (
                    <p className="text-xs text-gray-800">
                      <span className="font-semibold text-gray-900">Clock-out:</span>{" "}
                      <span className="line-clamp-3">{entry.notes}</span>
                    </p>
                  )}
                </div>
                {images.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs font-semibold text-gray-800 mb-2">Photos</p>
                    <div className="flex flex-wrap gap-2">
                      {images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => openViewer(images, idx)}
                          className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
                          aria-label={`View photo ${idx + 1}`}
                        >
                          <img src={img} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDetailEntry(entry);
                    setDetailOpen(true);
                  }}
                  className="mt-2 inline-flex items-center justify-center w-full px-3 py-2 text-xs font-semibold text-blue-700 border border-blue-200 bg-blue-50 rounded-lg hover:border-blue-300 hover:bg-blue-100 transition-colors"
                >
                  View details
                </button>
              </div>
            );
          })}
        </div>

        {/* Desktop/tablet table */}
        <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 hidden sm:block">
          <div className="inline-block min-w-full align-middle px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Job / Task</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Clock in</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Clock out</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Duration</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Notes</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                        No records found for this range.
                      </td>
                    </tr>
                  )}
                  {filtered.map((entry, rowIdx) => {
                    const duration = getDuration(entry);
                    const images = getImages(entry);
                    return (
                      <tr
                        key={entry.id}
                        className={`hover:bg-gray-50 transition-colors ${rowIdx % 2 === 1 ? "bg-gray-50/50" : ""}`}
                      >
                        <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                          {formatDateShort(entry.clockIn)}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          <div className="font-semibold text-gray-900">
                            {entry.jobTitle || "General task"}
                          </div>
                          {entry.clockInNotes && (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2 break-words max-w-xs">
                              {entry.clockInNotes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {formatTime(entry.clockIn)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {entry.clockOut ? formatTime(entry.clockOut) : (
                            <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-full text-xs font-semibold">
                              • In progress
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                            {duration.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 space-y-2 align-top">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailEntry(entry);
                              setDetailOpen(true);
                            }}
                            className="inline-flex items-center px-3 py-2 text-xs font-semibold text-blue-700 border border-blue-200 bg-blue-50 rounded-lg hover:border-blue-300 hover:bg-blue-100 transition-colors"
                          >
                            View details
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              entry.isRework
                                ? "text-purple-700 bg-purple-50 border-purple-200"
                                : "text-blue-700 bg-blue-50 border-blue-200"
                            }`}
                          >
                            {entry.isRework ? "Rework" : "Standard"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {viewerOpen && (
        <PhotoViewerModal
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {detailOpen && detailEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <p className="text-xs text-gray-500">Time entry details</p>
                <h3 className="text-lg font-bold text-gray-900">
                  {formatDateShort(detailEntry.clockIn)}
                </h3>
              </div>
              <button
                onClick={() => {
                  setDetailOpen(false);
                  setDetailEntry(null);
                }}
                className="text-gray-400 hover:text-gray-600 active:text-gray-800 rounded-full w-10 h-10 flex items-center justify-center border border-gray-200 bg-white"
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            <div className="px-4 sm:px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium">Clock in</p>
                  <p className="text-sm font-semibold text-gray-900">{formatTime(detailEntry.clockIn)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium">Clock out</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {detailEntry.clockOut ? formatTime(detailEntry.clockOut) : "In progress"}
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium">Duration</p>
                  <p className="text-sm font-semibold text-gray-900">{getDuration(detailEntry).label}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium">Type</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {detailEntry.isRework ? "Rework" : "Standard"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">Job / Task</p>
                <p className="text-sm font-semibold text-gray-900">
                  {detailEntry.jobTitle || "General task"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {detailEntry.clockInNotes && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-700">Clock-in note</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{detailEntry.clockInNotes}</p>
                  </div>
                )}
                {detailEntry.notes && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-700">Clock-out note</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{detailEntry.notes}</p>
                  </div>
                )}
                {!detailEntry.clockInNotes && !detailEntry.notes && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-700">Notes</p>
                    <p className="text-sm text-gray-500">No notes provided.</p>
                  </div>
                )}
              </div>

              {getImages(detailEntry).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">Photos</p>
                    <p className="text-xs text-gray-500">{getImages(detailEntry).length} file(s)</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getImages(detailEntry).map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => openViewer(getImages(detailEntry), idx)}
                        className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
                        aria-label={`View photo ${idx + 1}`}
                      >
                        <img src={img} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 sm:px-6 py-3 border-t border-gray-200 bg-gray-50 sticky bottom-0 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setDetailOpen(false);
                  setDetailEntry(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors min-h-[40px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

