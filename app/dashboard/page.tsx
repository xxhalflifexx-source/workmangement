import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { formatDateShort } from "@/lib/date-utils";
import DashboardHeaderActions from "./DashboardHeaderActions";
import { getNotifications, getUnreadCountsByModule } from "./notifications-actions";
import { getUserPermissionsForSession } from "../admin/user-access-actions";
import { hasPermission, ModulePermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import DashboardTabLink from "./DashboardTabLink";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  
  // For iOS Safari: Allow page to load even if session isn't immediately available
  // Client-side components will handle session verification
  // This was the original working approach
  if (!session?.user) {
    // Only redirect if we're sure there's no session (not iOS)
    // iOS Safari might need client-side session check
    redirect("/login");
  }
  
  const user = session.user;
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

  // Get unread counts by module
  const unreadCountsRes = await getUnreadCountsByModule();
  const unreadCounts = unreadCountsRes.ok && unreadCountsRes.counts ? unreadCountsRes.counts : {};

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
            <DashboardTabLink
              href="/time-clock"
              icon="⏰"
              title="Time Clock"
              description="Clock in/out"
              notificationCount={unreadCounts["/time-clock"] || 0}
            />
          )}

          {/* My Time Records - available to all roles */}
          {(role === "ADMIN" || role === "MANAGER" || role === "EMPLOYEE") && (
            <DashboardTabLink
              href="/time-records"
              icon="📒"
              title="My Time Records"
              description="View logged hours"
              notificationCount={unreadCounts["/time-records"] || 0}
            />
          )}

          {/* Job Management - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "jobManagement"))) && (
            <DashboardTabLink
              href="/jobs"
              icon="📋"
              title="Job Management"
              description="View & manage jobs"
              notificationCount={unreadCounts["/jobs"] || 0}
            />
          )}

          {/* Quality Control - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "qualityControl"))) && (
            <DashboardTabLink
              href="/qc"
              icon="✅"
              title="Quality Control"
              description="Review photos"
              notificationCount={unreadCounts["/qc"] || 0}
            />
          )}

          {/* HR - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "hr"))) && (
            <DashboardTabLink
              href="/hr"
              icon="👥"
              title="HR"
              description="Employee stats"
              notificationCount={unreadCounts["/hr"] || 0}
            />
          )}

          {/* Finance - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "finance"))) && (
            <DashboardTabLink
              href="/finance"
              icon="💰"
              title="Finance"
              description="Financial reports"
              notificationCount={unreadCounts["/finance"] || 0}
            />
          )}

          {/* Inventory - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "inventory"))) && (
            <DashboardTabLink
              href="/inventory"
              icon="📦"
              title="Inventory"
              description="Materials & requests"
              notificationCount={unreadCounts["/inventory"] || 0}
            />
          )}

          {/* Admin Panel - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "adminPanel"))) && (
            <DashboardTabLink
              href="/admin"
              icon="⚙️"
              title="Admin Panel"
              description="System settings"
              notificationCount={unreadCounts["/admin"] || 0}
              className="hover:border-red-300"
            />
          )}

          {/* Employee Handbook - Check permission */}
          {(role === "ADMIN" || (permissions && hasPermission(permissions, "employeeHandbook"))) && (
            <DashboardTabLink
              href="/handbook"
              icon="📖"
              title="Employee Handbook"
              description="Company policies"
              notificationCount={unreadCounts["/handbook"] || 0}
            />
          )}

          {/* Manual - Visible to Employees, Managers, and Admin */}
          {(role === "ADMIN" || role === "MANAGER" || role === "EMPLOYEE") && (
            <DashboardTabLink
              href="/manual"
              icon="📚"
              title="Manual"
              description="Standard Operating Procedures"
              notificationCount={unreadCounts["/manual"] || 0}
            />
          )}

          {/* Operations Common - Visible to Employees, Managers, and Admin */}
          {(role === "ADMIN" || role === "MANAGER" || role === "EMPLOYEE") && (
            <DashboardTabLink
              href="/operations-common"
              icon="📁"
              title="Operations Common"
              description="Common operational documents"
              notificationCount={unreadCounts["/operations-common"] || 0}
            />
          )}
        </div>
      </div>
    </main>
  );
}

