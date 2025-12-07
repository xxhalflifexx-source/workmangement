import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import { formatDateShort } from "@/lib/date-utils";
import DashboardHeaderActions from "./DashboardHeaderActions";
import { getNotifications } from "./notifications-actions";
import { getUserPermissionsForSession } from "../admin/user-access-actions";
import { hasPermission, ModulePermission } from "@/lib/permissions";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = (user as any)?.role || "EMPLOYEE";

  // Get user permissions
  const permissionsRes = await getUserPermissionsForSession();
  const permissions = permissionsRes.ok ? permissionsRes.permissions : null;

  // Get current time for greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Load notifications
  const notificationsRes = await getNotifications();
  const notifications = notificationsRes.ok && notificationsRes.notifications ? notificationsRes.notifications : [];
  const unreadCount = notificationsRes.ok ? (notificationsRes.unreadCount || 0) : 0;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b relative z-20">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Employee Portal</h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Welcome back, {user?.name}</p>
          </div>
          <DashboardHeaderActions
            userName={user?.name}
            userEmail={user?.email}
            userRole={role}
            initialNotifications={notifications as any}
            initialUnreadCount={unreadCount}
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8 relative z-0 page-transition">
        {/* Welcome Message */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 text-white relative z-0 transition-all duration-300 hover:shadow-xl">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* Time Clock - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "timeClock"))) && (
            <Link
              href="/time-clock"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]"
            >
              <div className="text-3xl sm:text-4xl mb-2">⏰</div>
              <div className="font-semibold text-sm sm:text-base text-gray-900">Time Clock</div>
              <div className="text-xs text-gray-500 mt-1">Clock in/out</div>
            </Link>
          )}

          {/* Job Management - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "jobManagement"))) && (
            <Link
              href="/jobs"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]"
            >
              <div className="text-3xl sm:text-4xl mb-2">📋</div>
              <div className="font-semibold text-sm sm:text-base text-gray-900">Job Management</div>
              <div className="text-xs text-gray-500 mt-1">View & manage jobs</div>
            </Link>
          )}

          {/* Quality Control - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "qualityControl"))) && (
            <Link
              href="/qc"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]"
            >
              <div className="text-3xl sm:text-4xl mb-2">✅</div>
              <div className="font-semibold text-sm sm:text-base text-gray-900">Quality Control</div>
              <div className="text-xs text-gray-500 mt-1">Review photos</div>
            </Link>
          )}

          {/* HR - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "hr"))) && (
            <Link
              href="/hr"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]"
            >
              <div className="text-3xl sm:text-4xl mb-2">👥</div>
              <div className="font-semibold text-sm sm:text-base text-gray-900">HR</div>
              <div className="text-xs text-gray-500 mt-1">Employee stats</div>
            </Link>
          )}

          {/* Finance - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "finance"))) && (
            <Link
              href="/finance"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]"
            >
              <div className="text-3xl sm:text-4xl mb-2">💰</div>
              <div className="font-semibold text-sm sm:text-base text-gray-900">Finance</div>
              <div className="text-xs text-gray-500 mt-1">Financial reports</div>
            </Link>
          )}

          {/* Inventory - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "inventory"))) && (
            <Link
              href="/inventory"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]"
            >
              <div className="text-3xl sm:text-4xl mb-2">📦</div>
              <div className="font-semibold text-sm sm:text-base text-gray-900">Inventory</div>
              <div className="text-xs text-gray-500 mt-1">Materials & requests</div>
            </Link>
          )}

          {/* Admin Panel - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "adminPanel"))) && (
            <Link
              href="/admin"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all duration-300 hover:border-red-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]"
            >
              <div className="text-3xl sm:text-4xl mb-2">⚙️</div>
              <div className="font-semibold text-sm sm:text-base text-gray-900">Admin Panel</div>
              <div className="text-xs text-gray-500 mt-1">System settings</div>
            </Link>
          )}

          {/* Employee Handbook - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "employeeHandbook"))) && (
            <Link
              href="/handbook"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]"
            >
              <div className="text-3xl sm:text-4xl mb-2">📖</div>
              <div className="font-semibold text-sm sm:text-base text-gray-900">Employee Handbook</div>
              <div className="text-xs text-gray-500 mt-1">Company policies</div>
            </Link>
          )}

          {/* Manual - Visible to Employees, Managers, and Admin */}
          {(role === "ADMIN" || role === "MANAGER" || role === "EMPLOYEE") && (
            <Link
              href="/manual"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]"
            >
              <div className="text-3xl sm:text-4xl mb-2">📚</div>
              <div className="font-semibold text-sm sm:text-base text-gray-900">Manual</div>
              <div className="text-xs text-gray-500 mt-1">Standard Operating Procedures</div>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

