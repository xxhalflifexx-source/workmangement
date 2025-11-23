import { getJobsAwaitingQC, getQCWorkers } from "./actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import QCJobRow from "./QCJobRow";
import QCFilters from "./QCFilters";

export default async function QCPage({
  searchParams,
}: {
  searchParams?: {
    qc?: string;
    q?: string;
    status?: string;
    worker?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any | undefined;
  const role = user?.role || "EMPLOYEE";
  const showSuccess = searchParams?.qc === "ok";
  const search = searchParams?.q || "";
  const statusFilter = searchParams?.status || "ALL";
  const workerFilter = searchParams?.worker || "";
  const dateFrom = searchParams?.dateFrom || "";
  const dateTo = searchParams?.dateTo || "";

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

  const [jobsResult, workersResult] = await Promise.all([
    getJobsAwaitingQC(search, statusFilter, workerFilter, dateFrom, dateTo),
    getQCWorkers(),
  ]);

  const { ok, jobs, error } = jobsResult;
  const workers = workersResult.ok ? workersResult.workers : [];

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-24 py-4 flex justify-between items-center">
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

      <div className="max-w-full mx-auto px-24 py-8 space-y-6">
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            QC result saved successfully. Job list below has been refreshed.
          </div>
        )}

        <form
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6"
          action="/qc"
          method="GET"
        >
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
          {/* preserve filters and qc success flag when searching */}
          {statusFilter && statusFilter !== "ALL" && (
            <input type="hidden" name="status" value={statusFilter} />
          )}
          {workerFilter && <input type="hidden" name="worker" value={workerFilter} />}
          {dateFrom && <input type="hidden" name="dateFrom" value={dateFrom} />}
          {dateTo && <input type="hidden" name="dateTo" value={dateTo} />}
          {showSuccess && <input type="hidden" name="qc" value="ok" />}
        </form>

        <QCFilters workers={workers} />
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
          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task Title / Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Worker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Photo Thumbnail
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job: any) => (
                    <QCJobRow key={job.id} job={job} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


