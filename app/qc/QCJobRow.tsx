"use client";

import { useState } from "react";
import { submitQCReviewAction } from "./actions";
import PhotoViewerModal from "./PhotoViewerModal";
import { formatDateShort, formatDateTime } from "@/lib/date-utils";

interface QCJobRowProps {
  job: any;
}

export default function QCJobRow({ job }: QCJobRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);

  const totalHours = job.timeEntries.reduce((sum: number, te: any) => {
    if (!te.clockOut) return sum;
    const hours =
      te.durationHours ??
      (new Date(te.clockOut).getTime() - new Date(te.clockIn).getTime()) /
        (1000 * 60 * 60);
    return sum + (hours || 0);
  }, 0);

  const lastEntry = job.timeEntries[job.timeEntries.length - 1];
  const lastWorkerName = lastEntry?.user?.name || "Unknown";

  const uniqueWorkers: { id: string; name: string }[] = [];
  job.timeEntries.forEach((te: any) => {
    if (!te.user) return;
    if (!uniqueWorkers.find((w) => w.id === te.user.id)) {
      uniqueWorkers.push({
        id: te.user.id,
        name: te.user.name || "Worker",
      });
    }
  });

  // Extract photos from QCRecords and JobActivities
  const allPhotos: string[] = [];
  
  // Photos from QC records
  job.qcRecords.forEach((qc: any) => {
    if (qc.photos) {
      try {
        const parsed = JSON.parse(qc.photos);
        if (Array.isArray(parsed)) {
          allPhotos.push(...parsed);
        }
      } catch {
        // If not JSON, treat as single URL
        if (typeof qc.photos === "string") {
          allPhotos.push(qc.photos);
        }
      }
    }
  });

  // Photos from job activities (submitted by workers)
  job.activities?.forEach((activity: any) => {
    if (activity.images) {
      try {
        const parsed = JSON.parse(activity.images);
        if (Array.isArray(parsed)) {
          allPhotos.push(...parsed);
        }
      } catch {
        // If not JSON, treat as single URL
        if (typeof activity.images === "string") {
          allPhotos.push(activity.images);
        }
      }
    }
  });

  // Get up to 5 photos for thumbnails
  const thumbnailPhotos = allPhotos.slice(0, 5);

  // Format job number (use first 8 chars of ID)
  const jobNumber = job.id.substring(0, 8).toUpperCase();

  // Format date created
  const dateCreated = formatDateShort(job.createdAt);

  // Get status display
  const statusDisplay = job.status === "AWAITING_QC" ? "Submit to QC" : job.status;

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
          {job.assignee?.name || "Unassigned"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              job.status === "REWORK"
                ? "bg-orange-100 text-orange-800"
                : job.status === "COMPLETED"
                ? "bg-green-100 text-green-800"
                : "bg-purple-100 text-purple-800"
            }`}
          >
            {statusDisplay}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {dateCreated}
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
          <td colSpan={7} className="px-6 py-6 bg-gray-50">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">{job.title}</h2>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        job.status === "REWORK"
                          ? "bg-orange-100 text-orange-800"
                          : job.status === "COMPLETED"
                          ? "bg-green-100 text-green-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {statusDisplay}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">
                    Customer: <span className="font-medium">{job.customer?.name || "—"}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Assigned to:{" "}
                    <span className="font-medium">{job.assignee?.name || "Unassigned"}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-blue-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">
                      Estimated Hours
                    </p>
                    <p className="text-sm font-semibold text-blue-900">
                      {job.estimatedHours ? job.estimatedHours.toFixed(1) : "—"}
                    </p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-indigo-700 font-medium uppercase tracking-wide">
                      Actual Hours (all workers)
                    </p>
                    <p className="text-sm font-semibold text-indigo-900">
                      {totalHours.toFixed(1)} h
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">
                      Last Worker
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{lastWorkerName}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">
                      Entries
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {job.timeEntries.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Photos Gallery */}
              {allPhotos.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Photos Submitted by Workers
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {allPhotos.map((photo, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={photo}
                          alt={`QC Photo ${idx + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
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
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Work History (Time Entries)
                </h3>
                {job.timeEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">No time entries recorded for this job.</p>
                ) : (
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
                          const hours =
                            te.durationHours ??
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
                                {te.clockOut
                                  ? formatDateTime(te.clockOut)
                                  : "Active"}
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
                )}
              </div>

              {/* Previous QC + Rework */}
              {(job.qcRecords.length > 0 || job.reworkEntries.length > 0) && (
                <div className="border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                  {job.qcRecords.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">QC History</h4>
                      <div className="space-y-2">
                        {job.qcRecords.map((qc: any, idx: number) => (
                          <div key={qc.id} className="border-l-2 border-gray-300 pl-3">
                            <p>
                              <span className="font-medium">{qc.qcStatus}</span> on{" "}
                              {formatDateTime(qc.createdAt)}
                            </p>
                            {qc.notes && (
                              <p className="text-xs text-gray-500 mt-1">{qc.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {job.reworkEntries.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Rework History</h4>
                      <div className="space-y-2">
                        {job.reworkEntries.map((rw: any, idx: number) => (
                          <div key={rw.id} className="border-l-2 border-orange-300 pl-3">
                            <p>
                              Rework on {formatDateTime(rw.createdAt)}
                              {rw.responsibleUser && (
                                <> • Responsible: {rw.responsibleUser.name}</>
                              )}
                            </p>
                            {rw.reason && (
                              <p className="text-xs text-gray-500 mt-1">{rw.reason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* QC Form */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Record QC Result</h3>
                <form action={submitQCReviewAction} className="space-y-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name="qcStatus"
                        value="PASS"
                        defaultChecked
                        className="text-green-600"
                      />
                      <span>Pass</span>
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name="qcStatus"
                        value="MINOR_ISSUES"
                        className="text-yellow-600"
                      />
                      <span>Minor Issues (still complete)</span>
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name="qcStatus"
                        value="FAIL"
                        className="text-red-600"
                      />
                      <span>Fail – send back for rework</span>
                    </label>
                  </div>

                  {uniqueWorkers.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="block text-gray-700 mb-1">
                          Responsible workers for rework (if failed)
                        </label>
                        <div className="space-y-1 border border-gray-200 rounded-lg px-3 py-2 max-h-40 overflow-y-auto">
                          {uniqueWorkers.map((w, index) => (
                            <label
                              key={w.id}
                              className="flex items-center gap-2 text-sm text-gray-700"
                            >
                              <input
                                type="checkbox"
                                name="responsibleUserIds"
                                value={w.id}
                                defaultChecked={
                                  // Pre-check the last worker as a sensible default
                                  index === uniqueWorkers.length - 1
                                }
                                className="text-indigo-600 rounded"
                              />
                              <span>{w.name}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Select one or more workers who should be responsible for the rework if
                          this job fails QC. If none are selected, the currently assigned worker
                          will be used when possible.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      QC Notes
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Add details about what you inspected, issues found, or what went well..."
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Save QC Result
                    </button>
                  </div>
                </form>
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

