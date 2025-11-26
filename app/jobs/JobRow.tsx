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
  onMaterial?: (job: any) => void;
  onQuotation?: (job: any) => void;
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
  onMaterial,
  onQuotation,
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

  // Format job number (use first 8 chars of ID)
  const jobNumber = job.id.substring(0, 8).toUpperCase();

  // Format dates
  const startDate = formatDateShort(job.createdAt);
  const deadline = job.dueDate ? formatDateShort(job.dueDate) : "—";

  // Get assigned workers (could be multiple if there are time entries)
  const assignedWorkers = job.assignee
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

  // Get status display
  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "REWORK":
        return "bg-orange-100 text-orange-800";
      case "AWAITING_QC":
        return "bg-purple-100 text-purple-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const statusDisplay =
    job.status === "AWAITING_QC" ? "Submit to QC" : job.status.replace("_", " ");

  // Get all photos for this job
  const allPhotos = getAllJobPhotos(job);
  const thumbnailPhotos = allPhotos.slice(0, 5);

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
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {jobNumber}
        </td>
        <td className="px-6 py-4 text-sm text-gray-900">
          <div>
            <div className="font-medium">{job.title}</div>
            {job.description && (
              <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                {job.description}
              </div>
            )}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {job.customer?.name || "—"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {assignedWorkersDisplay}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(
              job.status
            )}`}
          >
            {statusDisplay}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {startDate}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {deadline}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          {thumbnailPhotos.length > 0 ? (
            <div className="flex gap-1 items-center">
              {thumbnailPhotos.map((photo, idx) => (
                <img
                  key={idx}
                  src={photo}
                  alt={`Photo ${idx + 1}`}
                  className="h-10 w-10 object-cover rounded border border-gray-200 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoViewerIndex(idx);
                    setShowPhotoViewer(true);
                  }}
                />
              ))}
              {allPhotos.length > 5 && (
                <span className="text-xs text-gray-500 ml-1">
                  +{allPhotos.length - 5}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">No photos</span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
          {isExpanded ? "▼" : "▶"}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} className="px-6 py-6 bg-gray-50">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">{job.title}</h2>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        job.status
                      )}`}
                    >
                      {statusDisplay}
                    </span>
                  </div>
                  {job.description && (
                    <p className="text-sm text-gray-600 mb-2">{job.description}</p>
                  )}
                  <div className="space-y-1 text-sm text-gray-500">
                    <p>
                      Customer: <span className="font-medium text-gray-900">{job.customer?.name || "—"}</span>
                    </p>
                    <p>
                      Assigned to:{" "}
                      <span className="font-medium text-gray-900">{assignedWorkersDisplay}</span>
                    </p>
                    <p>
                      Created by: <span className="font-medium text-gray-900">{job.creator?.name || "—"}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {job.estimatedHours && (
                    <div className="bg-blue-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">
                        Estimated Hours
                      </p>
                      <p className="text-sm font-semibold text-blue-900">
                        {job.estimatedHours.toFixed(1)}
                      </p>
                    </div>
                  )}
                  {totalHours > 0 && (
                    <div className="bg-indigo-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-indigo-700 font-medium uppercase tracking-wide">
                        Actual Hours
                      </p>
                      <p className="text-sm font-semibold text-indigo-900">
                        {totalHours.toFixed(1)} h
                      </p>
                    </div>
                  )}
                  {job.estimatedPrice && (
                    <div className="bg-green-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-green-700 font-medium uppercase tracking-wide">
                        Estimated Price
                      </p>
                      <p className="text-sm font-semibold text-green-900">
                        ${job.estimatedPrice.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  )}
                  {job.finalPrice && (
                    <div className="bg-green-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-green-700 font-medium uppercase tracking-wide">
                        Final Price
                      </p>
                      <p className="text-sm font-semibold text-green-900">
                        ${job.finalPrice.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Time Entries */}
              {job.timeEntries && job.timeEntries.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Work History (Time Entries)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                            Worker
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                            Clock In
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                            Clock Out
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">
                            Hours
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.timeEntries.map((te: any) => {
                          const hours = te.durationHours ??
                            (te.clockOut
                              ? (new Date(te.clockOut).getTime() -
                                  new Date(te.clockIn).getTime()) /
                                (1000 * 60 * 60)
                              : null);

                          return (
                            <tr key={te.id} className="odd:bg-white even:bg-gray-50">
                              <td className="px-3 py-2 border-b text-gray-900">
                                {te.user?.name || "Worker"}
                              </td>
                              <td className="px-3 py-2 border-b text-gray-600">
                                {formatDateTime(te.clockIn)}
                              </td>
                              <td className="px-3 py-2 border-b text-gray-600">
                                {te.clockOut ? formatDateTime(te.clockOut) : "Active"}
                              </td>
                              <td className="px-3 py-2 border-b text-right text-gray-900">
                                {hours !== null ? hours.toFixed(2) : "—"}
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
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">📷 Job Photos</h3>
                  
                  {/* Locked message when submitted to QC */}
                  {job.status === "AWAITING_QC" && (
                    <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-xs text-purple-800 font-medium">
                        🔒 This job has been submitted to QC. Editing is locked until returned for rework.
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
                        className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <span>📷</span>
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

                      <div className="flex gap-2 mt-3">
                        {(jobPhotoFiles[job.id] || []).length > 0 && onSavePhotos && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSavePhotos(job.id);
                            }}
                            disabled={savingPhotos[job.id]}
                            className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
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
                            className={`px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed ${
                              (jobPhotoFiles[job.id] || []).length > 0 ? "flex-1" : "w-full"
                            }`}
                          >
                            {savingPhotos[job.id] ? "Submitting..." : "Submit to QC"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-2">
                {onActivity && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivity(job);
                    }}
                    disabled={job.status === "AWAITING_QC" || job.status === "COMPLETED"}
                    className="px-3 py-2 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    title={job.status === "AWAITING_QC" || job.status === "COMPLETED" ? "Job is locked - submitted to QC" : "View notes, photos, and updates for this job"}
                  >
                    📝 Activity
                  </button>
                )}
                {onMaterial && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMaterial(job);
                    }}
                    disabled={job.status === "AWAITING_QC" || job.status === "COMPLETED"}
                    className="px-3 py-2 text-sm border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    title={job.status === "AWAITING_QC" || job.status === "COMPLETED" ? "Job is locked - submitted to QC" : "View and request materials for this job"}
                  >
                    📦 Materials
                  </button>
                )}
                {canManage && onQuotation && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuotation(job);
                    }}
                    className="px-3 py-2 text-sm border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors font-medium"
                    title="Create quotation for this job"
                  >
                    💰 Create Quotation
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
                      className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      title={job.status === "AWAITING_QC" || job.status === "COMPLETED" ? "Job is locked - submitted to QC" : "Edit job"}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to delete this job?")) {
                          onDelete(job.id);
                        }
                      }}
                      className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium"
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
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

