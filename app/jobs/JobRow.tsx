"use client";

import { useState } from "react";
import PhotoViewerModal from "../qc/PhotoViewerModal";
import { formatDateShort, formatDateTime } from "@/lib/date-utils";

interface JobRowProps {
  job: any;
  canManage: boolean;
  onEdit: (job: any) => void;
  onDelete: (jobId: string) => void;
  onViewPhotos: (photos: string[], index: number) => void;
  getAllJobPhotos: (job: any) => string[];
  jobExistingPhotos: Array<{ id: string; url: string; activityId: string }>;
  onActivity?: (job: any) => void;
  onMaterialsAndExpenses?: (job: any) => void;
  onQuotation?: (job: any) => void;
  jobExpenses?: any[];
  onPhotoSelect?: (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onSavePhotos?: (jobId: string) => void;
  onSubmitToQC?: (jobId: string) => void;
  onRemovePhoto?: (jobId: string, photoId: string, photoUrl: string, activityId: string) => void;
  onRemovePhotoFile?: (jobId: string, index: number) => void;
  jobPhotoFiles?: Record<string, File[]>;
  savingPhotos?: Record<string, boolean>;
  removingPhotos?: Record<string, boolean>;
  openPhotoViewer?: (job: any, index: number) => void;
}

export default function JobRow({
  job,
  canManage,
  onEdit,
  onDelete,
  onViewPhotos,
  getAllJobPhotos,
  jobExistingPhotos,
  onActivity,
  onMaterialsAndExpenses,
  onQuotation,
  jobExpenses = [],
  onPhotoSelect,
  onSavePhotos,
  onSubmitToQC,
  onRemovePhoto,
  onRemovePhotoFile,
  jobPhotoFiles = {},
  savingPhotos = {},
  removingPhotos = {},
  openPhotoViewer,
}: JobRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);

  // Format job number - use actual jobNumber if available, otherwise fallback to ID
  const jobNumber = job.jobNumber || `#${job.id.substring(0, 8).toUpperCase()}`;
  
  // Check if job is cancelled
  const isCancelled = job.status === "CANCELLED";

  // Format dates
  const startDate = formatDateShort(job.createdAt);
  const deadline = job.dueDate ? formatDateShort(job.dueDate) : "—";

  // Get assigned workers from new assignments array, fallback to old assignee, then time entries
  const assignedWorkers = job.assignments && job.assignments.length > 0
    ? job.assignments.map((a: any) => a.user?.name).filter((name: string | null) => name)
    : job.assignee
    ? [job.assignee.name]
    : job.timeEntries
    ? Array.from(
        new Set(
          job.timeEntries
            .map((te: any) => te.user?.name)
            .filter((name: string | null) => name)
        )
      )
    : [];
  const assignedWorkersDisplay =
    assignedWorkers.length > 0
      ? assignedWorkers.join(", ")
      : "Unassigned";

  // Get status display with professional color scheme
  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "REWORK":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      case "AWAITING_QC":
        return "bg-indigo-50 text-indigo-700 border border-indigo-200";
      case "IN_PROGRESS":
        return "bg-blue-50 text-blue-700 border border-blue-200";
      case "CANCELLED":
        return "bg-red-50 text-red-700 border border-red-200";
      case "NOT_STARTED":
        return "bg-slate-50 text-slate-700 border border-slate-200";
      default:
        return "bg-gray-50 text-gray-700 border border-gray-200";
    }
  };

  const statusDisplay =
    job.status === "AWAITING_QC" ? "Submit to QC" : job.status.replace("_", " ");

  // Get all photos for this job
  const allPhotos = getAllJobPhotos(job);

  // Calculate total hours
  const totalHours = job.timeEntries
    ? job.timeEntries.reduce((sum: number, te: any) => {
        if (!te.clockOut) return sum;
        const hours =
          te.durationHours ??
          (new Date(te.clockOut).getTime() - new Date(te.clockIn).getTime()) /
            (1000 * 60 * 60);
        return sum + (hours || 0);
      }, 0)
    : 0;

  return (
    <>
      <tr
        className={`cursor-pointer transition-all duration-200 ${
          isCancelled
            ? "bg-gray-100 opacity-60 border-l-4 border-l-red-400"
            : isExpanded 
              ? "bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 border-l-4 border-l-indigo-600 shadow-sm" 
              : "hover:bg-gray-50 border-l-4 border-l-transparent"
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-4 sm:px-6 py-4">
          <div className={`text-sm font-mono font-medium ${isCancelled ? "text-gray-500" : "text-gray-900"}`}>
            {jobNumber}
          </div>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <div className="min-w-0">
            <div className={`font-semibold truncate max-w-[150px] sm:max-w-[200px] ${isCancelled ? "text-gray-500 line-through" : "text-gray-900"}`} title={job.title}>
              {job.title}
            </div>
            {job.description && (
              <div className="text-xs text-gray-500 mt-1 line-clamp-1 truncate max-w-[150px] sm:max-w-[200px]" title={job.description}>
                {job.description}
              </div>
            )}
          </div>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <div className="text-sm font-medium text-gray-700 truncate max-w-[120px] sm:max-w-[150px]" title={job.customer?.name || "—"}>
            {job.customer?.name || <span className="text-gray-400 italic">Unassigned</span>}
          </div>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <div className="text-sm text-gray-600 truncate max-w-[120px] sm:max-w-[150px]" title={assignedWorkersDisplay}>
            {assignedWorkersDisplay}
          </div>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide ${getStatusColor(
              job.status
            )}`}
          >
            {statusDisplay}
          </span>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <div className="text-sm text-gray-600 font-medium">{startDate}</div>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <div className="text-sm text-gray-600 font-medium">{deadline}</div>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-center">
            <span className={`text-sm font-semibold transition-transform duration-200 ${isExpanded ? 'text-indigo-600 rotate-180' : 'text-gray-400'}`}>
              ▼
            </span>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-3 sm:px-6 py-4 sm:py-6 bg-gradient-to-br from-indigo-50/30 to-blue-50/30">
            <div className="bg-white border-2 border-indigo-100 rounded-2xl shadow-lg p-6 sm:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
                    <span
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide ${getStatusColor(
                        job.status
                      )}`}
                    >
                      {statusDisplay}
                    </span>
                  </div>
                  {job.description && (
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">{job.description}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 font-medium">Customer:</span>
                      <span className="font-semibold text-gray-900">{job.customer?.name || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 font-medium">Assigned to:</span>
                      <span className="font-semibold text-gray-900">{assignedWorkersDisplay}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 font-medium">Created by:</span>
                      <span className="font-semibold text-gray-900">{job.creator?.name || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {job.estimatedHours && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-xl px-4 py-3 shadow-sm">
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">
                        Estimated Hours
                      </p>
                      <p className="text-lg font-bold text-blue-900">
                        {job.estimatedHours.toFixed(1)}
                      </p>
                    </div>
                  )}
                  {totalHours > 0 && (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-100 rounded-xl px-4 py-3 shadow-sm">
                      <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">
                        Actual Hours
                      </p>
                      <p className="text-lg font-bold text-emerald-900">
                        {totalHours.toFixed(1)} h
                      </p>
                    </div>
                  )}
                  {job.estimatedPrice && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-100 rounded-xl px-4 py-3 shadow-sm">
                      <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider mb-1">
                        Estimated Price
                      </p>
                      <p className="text-lg font-bold text-amber-900">
                        ${job.estimatedPrice.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  )}
                  {job.finalPrice && (
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-100 rounded-xl px-4 py-3 shadow-sm">
                      <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider mb-1">
                        Final Price
                      </p>
                      <p className="text-lg font-bold text-purple-900">
                        ${job.finalPrice.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Expenses & Profit Summary */}
              {canManage && (job.finalPrice || job.estimatedPrice) && (
                <div className="border-t-2 border-indigo-100 pt-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-indigo-600 rounded-full"></span>
                    Financial Summary
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(() => {
                      const totalExpenses = (jobExpenses || []).reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
                      const revenue = job.finalPrice || job.estimatedPrice || 0;
                      const profit = revenue - totalExpenses;
                      const profitMargin = revenue > 0 ? ((profit / revenue) * 100) : 0;
                      
                      return (
                        <>
                          <div className="bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-100 rounded-xl px-4 py-3 shadow-sm">
                            <p className="text-xs text-red-600 font-semibold uppercase tracking-wider mb-1">
                              Total Expenses
                            </p>
                            <p className="text-lg font-bold text-red-900">
                              ${totalExpenses.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-100 rounded-xl px-4 py-3 shadow-sm">
                            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">
                              Revenue
                            </p>
                            <p className="text-lg font-bold text-blue-900">
                              ${revenue.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div className={`bg-gradient-to-br border-2 rounded-xl px-4 py-3 shadow-sm ${
                            profit >= 0 
                              ? "from-emerald-50 to-teal-50 border-emerald-100" 
                              : "from-red-50 to-rose-50 border-red-100"
                          }`}>
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                              profit >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}>
                              Profit ({profitMargin >= 0 ? "+" : ""}{profitMargin.toFixed(1)}%)
                            </p>
                            <p className={`text-lg font-bold ${
                              profit >= 0 ? "text-emerald-900" : "text-red-900"
                            }`}>
                              ${profit.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Time Entries */}
              {job.timeEntries && job.timeEntries.length > 0 && (
                <div className="border-t-2 border-indigo-100 pt-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-indigo-600 rounded-full"></span>
                    Work History (Time Entries)
                  </h3>
                  <div className="overflow-x-auto rounded-xl border-2 border-gray-100 shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-indigo-50 to-blue-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-indigo-900 border-b-2 border-indigo-200">
                            Worker
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-indigo-900 border-b-2 border-indigo-200">
                            Clock In
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-indigo-900 border-b-2 border-indigo-200">
                            Clock Out
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-indigo-900 border-b-2 border-indigo-200">
                            Hours
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {job.timeEntries.map((te: any) => {
                          const hours = te.durationHours ??
                            (te.clockOut
                              ? (new Date(te.clockOut).getTime() -
                                  new Date(te.clockIn).getTime()) /
                                (1000 * 60 * 60)
                              : null);

                          return (
                            <tr key={te.id} className="hover:bg-indigo-50/50 transition-colors">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {te.user?.name || "Worker"}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {formatDateTime(te.clockIn)}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {te.clockOut ? formatDateTime(te.clockOut) : <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-700 text-xs font-semibold">Active</span>}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                {hours !== null ? `${hours.toFixed(2)}h` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Photo Upload Section */}
              {job.status !== "COMPLETED" && job.status !== "CANCELLED" && (
                <div className="border-t-2 border-indigo-100 pt-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-indigo-600 rounded-full"></span>
                    Job Photos
                  </h3>
                  
                  {/* Locked message when submitted to QC */}
                  {job.status === "AWAITING_QC" && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl shadow-sm">
                      <p className="text-sm text-indigo-800 font-semibold flex items-center gap-2">
                        <span className="text-lg">🔒</span>
                        This job has been submitted to QC. Editing is locked until returned for rework.
                      </p>
                    </div>
                  )}

                  {/* Existing Photos */}
                  {(jobExistingPhotos || []).length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-600 mb-2">
                        Saved Photos: {(jobExistingPhotos || []).length}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {(jobExistingPhotos || []).map((photo) => {
                          const allPhotos = getAllJobPhotos(job);
                          const photoIndexInAll = allPhotos.findIndex((url) => url === photo.url);
                          return (
                            <div
                              key={photo.id}
                              className="relative bg-gray-100 border border-gray-200 rounded p-2 flex flex-col items-center gap-2"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openPhotoViewer) {
                                    openPhotoViewer(job, photoIndexInAll >= 0 ? photoIndexInAll : 0);
                                  } else {
                                    setPhotoViewerIndex(photoIndexInAll >= 0 ? photoIndexInAll : 0);
                                    setShowPhotoViewer(true);
                                  }
                                }}
                                className="w-full h-24 bg-gray-200 rounded overflow-hidden hover:opacity-80 transition-opacity cursor-pointer flex-shrink-0"
                                type="button"
                              >
                                <img
                                  src={photo.url}
                                  alt="Saved photo"
                                  className="w-full h-full object-cover"
                                />
                              </button>
                              <p className="text-xs text-gray-600">Saved</p>
                              {job.status !== "AWAITING_QC" && job.status !== "COMPLETED" && onRemovePhoto && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemovePhoto(job.id, photo.id, photo.url, photo.activityId);
                                  }}
                                  disabled={removingPhotos[photo.id]}
                                  type="button"
                                  className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                                >
                                  {removingPhotos[photo.id] ? "..." : "✕ Remove"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Photo Upload (only if not locked) */}
                  {job.status !== "AWAITING_QC" && job.status !== "COMPLETED" && onPhotoSelect && (
                    <div className="space-y-3">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          e.stopPropagation();
                          onPhotoSelect(job.id, e);
                        }}
                        className="hidden"
                        id={`photo-upload-${job.id}`}
                        disabled={job.status === "AWAITING_QC" || job.status === "COMPLETED"}
                      />
                      <label
                        htmlFor={`photo-upload-${job.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl text-sm font-semibold text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all shadow-sm min-h-[44px]"
                      >
                        <span className="text-base">📷</span>
                        Choose Photos
                      </label>

                      {(jobPhotoFiles[job.id] || []).length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-gray-600">
                            New Photos Selected: {(jobPhotoFiles[job.id] || []).length} photo(s)
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {(jobPhotoFiles[job.id] || []).map((file, index) => (
                              <div
                                key={index}
                                className="relative bg-gray-100 border border-gray-200 rounded p-2 flex flex-col items-center gap-2"
                              >
                                <div className="w-full h-24 bg-gray-200 rounded overflow-hidden">
                                  <img
                                    src={URL.createObjectURL(file)}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <p className="text-xs flex-1 truncate text-center">{file.name}</p>
                                {onRemovePhotoFile && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemovePhotoFile(job.id, index);
                                    }}
                                    type="button"
                                    className="text-red-500 hover:text-red-700 text-xs"
                                  >
                                    ✕ Remove
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        {(jobPhotoFiles[job.id] || []).length > 0 && onSavePhotos && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSavePhotos(job.id);
                            }}
                            disabled={savingPhotos[job.id]}
                            className="w-full sm:flex-1 px-5 py-3 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed min-h-[44px] shadow-md"
                          >
                            {savingPhotos[job.id] ? "Saving..." : "Save Photos"}
                          </button>
                        )}
                        {onSubmitToQC && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSubmitToQC(job.id);
                            }}
                            disabled={savingPhotos[job.id]}
                            className="w-full sm:w-auto px-5 py-3 text-sm bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all font-semibold disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
                          >
                            <span className="text-base">✓</span>
                            <span>{savingPhotos[job.id] ? "Submitting..." : "Submit to QC"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="border-t-2 border-indigo-100 pt-6">
                <div className="flex flex-wrap gap-3">
                  {onMaterialsAndExpenses && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMaterialsAndExpenses(job);
                      }}
                      disabled={job.status === "AWAITING_QC" || job.status === "COMPLETED"}
                      className="px-5 py-3 text-sm bg-gradient-to-r from-emerald-50 to-rose-50 border-2 border-emerald-200 text-emerald-700 rounded-xl hover:from-emerald-100 hover:to-rose-100 hover:border-emerald-300 transition-all font-semibold disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2 shadow-sm"
                      title={job.status === "AWAITING_QC" || job.status === "COMPLETED" ? "Job is locked - submitted to QC" : "Request materials and report expenses for this job"}
                    >
                      <span className="text-base">📦💵</span>
                      <span>Materials & Expenses</span>
                    </button>
                  )}
                  {canManage && onQuotation && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuotation(job);
                      }}
                      className="px-5 py-3 text-sm bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 text-amber-700 rounded-xl hover:from-amber-100 hover:to-orange-100 hover:border-amber-300 transition-all font-semibold min-h-[44px] flex items-center justify-center gap-2 shadow-sm"
                      title="Create quotation for this job"
                    >
                      <span className="text-base">💰</span>
                      <span>Create Quotation</span>
                    </button>
                  )}
                  {canManage && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(job);
                        }}
                        disabled={job.status === "AWAITING_QC" || job.status === "COMPLETED"}
                        className="px-5 py-3 text-sm bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 text-indigo-700 rounded-xl hover:from-indigo-100 hover:to-purple-100 hover:border-indigo-300 transition-all font-semibold disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2 shadow-sm"
                        title={job.status === "AWAITING_QC" || job.status === "COMPLETED" ? "Job is locked - submitted to QC" : "Edit job"}
                      >
                        <span className="text-base">✏️</span>
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this job?")) {
                            onDelete(job.id);
                          }
                        }}
                        className="px-5 py-3 text-sm bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 text-red-700 rounded-xl hover:from-red-100 hover:to-pink-100 hover:border-red-300 transition-all font-semibold min-h-[44px] flex items-center justify-center gap-2 shadow-sm"
                      >
                        <span className="text-base">🗑️</span>
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Photo Viewer Modal */}
      {showPhotoViewer && (
        <PhotoViewerModal
          photos={allPhotos}
          initialIndex={photoViewerIndex}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}
    </>
  );
}

