import { getJobsAwaitingQC, submitQCReviewAction } from "./actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";

export default async function QCPage({
  searchParams,
}: {
  searchParams?: { qc?: string; q?: string };
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any | undefined;
  const role = user?.role || "EMPLOYEE";
  const showSuccess = searchParams?.qc === "ok";
  const search = searchParams?.q || "";

  if (!session?.user || (role !== "ADMIN" && role !== "MANAGER")) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-xl shadow-md p-8 max-w-lg text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-gray-600 mb-4">
            Quality Control tools are only available to managers and admins.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { ok, jobs, error } = await getJobsAwaitingQC(search);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quality Control Dashboard</h1>
            <p className="text-sm text-gray-500">
              Review jobs awaiting QC, record PASS / FAIL, and send items back for rework.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <form
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
          action="/qc"
          method="GET"
        >
          <div className="flex-1">
            {showSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4">
                QC result saved successfully. Job list below has been refreshed.
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Search by job or customer..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-gray-100 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-200"
            >
              Search
            </button>
          </div>
          {/* preserve qc success flag when searching again */}
          {showSuccess && <input type="hidden" name="qc" value="ok" />}
        </form>
        {!ok && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || "Failed to load QC jobs"}
          </div>
        )}

        {ok && jobs.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center text-gray-600">
            <p className="text-lg font-medium mb-2">No QC jobs found</p>
            <p className="text-sm">
              When a job is marked as <span className="font-semibold">Submit to QC</span>,{" "}
              <span className="font-semibold">REWORK</span>, or is recently{" "}
              <span className="font-semibold">COMPLETED</span>, it will appear here.
            </p>
          </div>
        )}

        {ok &&
          jobs.map((job: any) => {
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

            return (
              <section
                key={job.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-lg font-semibold text-gray-900">{job.title}</h2>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          job.status === "REWORK"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {job.status === "AWAITING_QC" ? "Submit to QC" : job.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-1">
                      Customer: <span className="font-medium">{job.customer?.name || "—"}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      Assigned to:{" "}
                      <span className="font-medium">
                        {job.assignee?.name || "Unassigned"}
                      </span>
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
                                  {new Date(te.clockIn).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 border-b text-gray-600">
                                  {te.clockOut
                                    ? new Date(te.clockOut).toLocaleString()
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

                {/* Previous QC + Rework (brief summary when card is closed) */}
                {(job.qcRecords.length > 0 || job.reworkEntries.length > 0) && (
                  <div className="border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                    {job.qcRecords.length > 0 && (() => {
                      const lastQc = job.qcRecords[job.qcRecords.length - 1];
                      const lastQcDate = new Date(lastQc.createdAt).toLocaleString();
                      return (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">QC History (brief)</h4>
                          <p>
                            <span className="font-medium">{lastQc.qcStatus}</span> on {lastQcDate}
                          </p>
                          {job.qcRecords.length > 1 && (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {job.qcRecords.length - 1} older QC record
                              {job.qcRecords.length - 1 > 1 ? "s" : ""} kept in history.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    {job.reworkEntries.length > 0 && (() => {
                      const lastRw = job.reworkEntries[job.reworkEntries.length - 1];
                      const lastRwDate = new Date(lastRw.createdAt).toLocaleString();
                      const reason =
                        (lastRw.reason || "").length > 60
                          ? `${lastRw.reason.slice(0, 57)}...`
                          : lastRw.reason || "";
                      return (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Rework History (brief)</h4>
                          <p>
                            Last rework on {lastRwDate}
                            {reason ? ` • ${reason}` : ""}
                          </p>
                          {job.reworkEntries.length > 1 && (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {job.reworkEntries.length - 1} older rework record
                              {job.reworkEntries.length - 1 > 1 ? "s" : ""} kept in history.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* QC Form */}
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Record QC Result
                  </h3>
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
              </section>
            );
          })}
      </div>
    </main>
  );
}


