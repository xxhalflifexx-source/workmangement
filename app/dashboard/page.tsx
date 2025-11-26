import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import { getJobAlertsForCurrentUser } from "../jobs/actions";
import { formatDateShort } from "@/lib/date-utils";
import UserMenu from "./UserMenu";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = (user as any)?.role || "EMPLOYEE";

  // Get current time for greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const alertsRes = await getJobAlertsForCurrentUser();
  const alerts = alertsRes.ok ? alertsRes.jobs : [];

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Employee Portal</h1>
            <p className="text-xs sm:text-sm text-gray-500">Welcome back, {user?.name}</p>
          </div>
          <UserMenu userName={user?.name} userEmail={user?.email} />
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8">
        {/* Welcome Message */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 break-words">
                {greeting}, {user?.name}! 👋
              </h2>
              <p className="text-blue-100 text-sm sm:text-base lg:text-lg mb-3 sm:mb-4">
                Ready to make today productive?
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 sm:px-3 py-1 bg-white/20 rounded-full text-xs sm:text-sm font-medium">
                  {role}
                </span>
                <span className="text-blue-100 hidden sm:inline">•</span>
                <span className="text-blue-100 text-xs sm:text-sm break-all">{user?.email}</span>
              </div>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-6xl flex-shrink-0">
              {role === "ADMIN" ? "👑" : role === "MANAGER" ? "📊" : "💼"}
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Time Clock Card */}
          <Link
            href="/time-clock"
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-200 hover:border-blue-300 min-h-[44px] flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                ⏰
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Quick Access
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Time Clock</h3>
            <p className="text-gray-600 text-xs sm:text-sm">Clock in/out and view your hours</p>
          </Link>

          {/* Jobs Card */}
          <Link
            href="/jobs"
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-200 hover:border-blue-300 min-h-[44px] flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
                📋
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Active
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Jobs</h3>
            <p className="text-gray-600 text-xs sm:text-sm">View and manage your assigned jobs</p>
          </Link>

          {/* Inventory Card */}
          <Link
            href="/inventory"
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-200 hover:border-blue-300 min-h-[44px] flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
                📦
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Updated
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Inventory</h3>
            <p className="text-gray-600 text-xs sm:text-sm">Check inventory and supplies</p>
          </Link>

          {/* Manager/Admin Only Cards */}
          {(role === "MANAGER" || role === "ADMIN") && (
            <Link
              href="/hr"
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-200 hover:border-yellow-300 min-h-[44px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center text-2xl">
                  👥
                </div>
                <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded font-medium">
                  Manager
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">HR</h3>
              <p className="text-gray-600 text-xs sm:text-sm">Manage team and HR tasks</p>
            </Link>
          )}

          {/* QC Dashboard Card - Manager/Admin only */}
          {(role === "MANAGER" || role === "ADMIN") && (
            <Link
              href="/qc"
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-200 hover:border-indigo-300 min-h-[44px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl">
                  ✅
                </div>
                <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded font-medium">
                  QC
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Quality Control</h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Review completed jobs, pass or fail work, and send items back for rework.
              </p>
            </Link>
          )}

          {/* Finance Card - Manager/Admin only */}
          {(role === "MANAGER" || role === "ADMIN") && (
            <Link
              href="/finance"
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-200 hover:border-green-300 min-h-[44px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
                  💰
                </div>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded font-medium">
                  Finance
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Finance</h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Track invoices, payments, and financial records.
              </p>
            </Link>
          )}

          {/* Admin / Manager Card */}
          {(role === "ADMIN" || role === "MANAGER") && (
            <Link
              href="/admin"
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-200 hover:border-red-300 min-h-[44px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-2xl">
                  ⚙️
                </div>
                <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded font-medium">
                  Admin / Manager
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Administrative</h3>
              <p className="text-gray-600 text-xs sm:text-sm">User management and company settings</p>
            </Link>
          )}
        </div>

        {/* Info + Job Alerts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 border border-gray-200 lg:col-span-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">📢 Quick Info</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
                • <span className="font-medium">Your Role:</span>{" "}
                <span className="text-blue-600 font-semibold">{role}</span>
            </p>
            <p>
              • <span className="font-medium">Access Level:</span>{" "}
              {role === "ADMIN"
                ? "Full system access"
                : role === "MANAGER"
                ? "Team management access"
                : "Standard employee access"}
            </p>
            <p>
              • <span className="font-medium">Account Status:</span>{" "}
              <span className="text-green-600 font-medium">✓ Active & Verified</span>
            </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6 border border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">🔔 Job Updates</h3>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500">
                No recent updates on your assigned jobs. You&apos;ll see rework and QC status changes
                here.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {alerts.map((job: any) => (
                  <li
                    key={job.id}
                    className="flex items-start justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2 bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{job.title}</p>
                      <p className="text-xs text-gray-500">
                        {job.customer?.name ? `Customer: ${job.customer.name} • ` : ""}
                        Updated:{" "}
                        {formatDateShort(job.updatedAt)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        job.status === "REWORK"
                          ? "bg-orange-100 text-orange-800"
                          : job.status === "AWAITING_QC"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {job.status === "AWAITING_QC" ? "Submit to QC" : job.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

