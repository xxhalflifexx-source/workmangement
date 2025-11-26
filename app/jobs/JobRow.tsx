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
}

export default function JobRow({
  job,
  canManage,
  onEdit,
  onDelete,
  onViewPhotos,
  getAllJobPhotos,
  jobExistingPhotos,
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

              {/* Photos Gallery */}
              {allPhotos.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Job Photos
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {allPhotos.map((photo, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={photo}
                          alt={`Job Photo ${idx + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoViewerIndex(idx);
                            setShowPhotoViewer(true);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Actions */}
              {canManage && (
                <div className="border-t border-gray-100 pt-4 flex gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(job);
                    }}
                    disabled={job.status === "AWAITING_QC" || job.status === "COMPLETED"}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Edit Job
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Are you sure you want to delete this job?")) {
                        onDelete(job.id);
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                  >
                    Delete Job
                  </button>
                </div>
              )}
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

