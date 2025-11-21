import { getJobsAwaitingQC, submitQCReviewAction } from "./actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";

export default async function QCPage({
  searchParams,
}: {
  searchParams?: { qc?: string; q?: string; view?: string };
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any | undefined;
  const role = user?.role || "EMPLOYEE";
  const showSuccess = searchParams?.qc === "ok";
  const search = searchParams?.q || "";
  const view = searchParams?.view === "history" ? "history" : "queue";

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

  const activeJobs = ok
    ? jobs.filter(
        (job: any) => job.status === "AWAITING_QC" || job.status === "REWORK"
      )
    : [];
  const historyJobs = ok
    ? jobs.filter(
        (job: any) => job.status === "COMPLETED" || job.status === "REWORK"
      )
    : [];

  const listLabel = view === "history" ? "History List" : "Job List";
  const listJobs = view === "history" ? historyJobs : activeJobs;

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

        {ok && jobs.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">QC Jobs & History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Job
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Customer
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Status
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">
                      Est. Hours
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">
                      Actual Hours
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Last QC
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Last Rework
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      QC Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job: any) => {
                    const totalHours = job.timeEntries.reduce((sum: number, te: any) => {
                      if (!te.clockOut) return sum;
                      const hours =
                        te.durationHours ??
                        (new Date(te.clockOut).getTime() - new Date(te.clockIn).getTime()) /
                          (1000 * 60 * 60);
                      return sum + (hours || 0);
                    }, 0);

                    const lastQc =
                      job.qcRecords && job.qcRecords.length > 0
                        ? job.qcRecords[job.qcRecords.length - 1]
                        : null;
                    const lastRw =
                      job.reworkEntries && job.reworkEntries.length > 0
                        ? job.reworkEntries[job.reworkEntries.length - 1]
                        : null;

                    const lastRwReason =
                      lastRw && lastRw.reason
                        ? (lastRw.reason.length > 40
                            ? `${lastRw.reason.slice(0, 37)}...`
                            : lastRw.reason)
                        : "";

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
                      <tr key={job.id} className="odd:bg-white even:bg-gray-50 align-top">
                        <td className="px-3 py-2 border-b text-gray-900 max-w-[180px]">
                          <div className="font-semibold truncate" title={job.title}>
                            {job.title}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Assigned: {job.assignee?.name || "Unassigned"}
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b text-gray-700 max-w-[160px]">
                          <span className="truncate block">
                            {job.customer?.name || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b text-gray-700">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              job.status === "REWORK"
                                ? "bg-orange-100 text-orange-800"
                                : job.status === "AWAITING_QC"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {job.status === "AWAITING_QC" ? "Submit to QC" : job.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b text-right text-gray-900">
                          {job.estimatedHours ? job.estimatedHours.toFixed(1) : "—"}
                        </td>
                        <td className="px-3 py-2 border-b text-right text-gray-900">
                          {totalHours.toFixed(1)} h
                        </td>
                        <td className="px-3 py-2 border-b text-gray-700 max-w-[180px]">
                          {lastQc ? (
                            <div>
                              <div className="font-medium text-[11px]">{lastQc.qcStatus}</div>
                              <div className="text-[11px] text-gray-500">
                                {new Date(lastQc.createdAt).toLocaleString()}
                              </div>
                              {job.qcRecords.length > 1 && (
                                <div className="text-[10px] text-gray-400">
                                  {job.qcRecords.length - 1} older record
                                  {job.qcRecords.length - 1 > 1 ? "s" : ""}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400">No QC yet</span>
                          )}
                        </td>
                        <td className="px-3 py-2 border-b text-gray-700 max-w-[200px]">
                          {lastRw ? (
                            <div>
                              <div className="text-[11px] text-gray-600">
                                {new Date(lastRw.createdAt).toLocaleString()}
                              </div>
                              {lastRwReason && (
                                <div className="text-[11px] text-gray-500">{lastRwReason}</div>
                              )}
                              {job.reworkEntries.length > 1 && (
                                <div className="text-[10px] text-gray-400">
                                  {job.reworkEntries.length - 1} older record
                                  {job.reworkEntries.length - 1 > 1 ? "s" : ""}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400">No rework yet</span>
                          )}
                        </td>
                        <td className="px-3 py-2 border-b text-gray-700 min-w-[220px]">
                          <form action={submitQCReviewAction} className="space-y-2">
                            <input type="hidden" name="jobId" value={job.id} />
                            <div className="flex flex-wrap gap-2 text-[11px]">
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
                                <span>Minor</span>
                              </label>
                              <label className="inline-flex items-center gap-1">
                                <input
                                  type="radio"
                                  name="qcStatus"
                                  value="FAIL"
                                  className="text-red-600"
                                />
                                <span>Fail</span>
                              </label>
                            </div>

                            {uniqueWorkers.length > 0 && (
                              <div className="border border-gray-200 rounded-lg px-2 py-1 max-h-20 overflow-y-auto text-[11px]">
                                {uniqueWorkers.map((w, index) => (
                                  <label
                                    key={w.id}
                                    className="flex items-center gap-1 text-gray-700"
                                  >
                                    <input
                                      type="checkbox"
                                      name="responsibleUserIds"
                                      value={w.id}
                                      defaultChecked={index === uniqueWorkers.length - 1}
                                      className="text-indigo-600 rounded"
                                    />
                                    <span className="truncate">{w.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            <textarea
                              name="notes"
                              rows={2}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-[11px]"
                              placeholder="QC notes..."
                            />

                            <button
                              type="submit"
                              className="w-full inline-flex items-center justify-center px-2 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-semibold hover:bg-blue-700 transition-colors"
                            >
                              Save QC
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


