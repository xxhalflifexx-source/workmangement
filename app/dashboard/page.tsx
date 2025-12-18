import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { formatDateShort } from "@/lib/date-utils";
import DashboardHeaderActions from "./DashboardHeaderActions";
import { getNotifications, getUnreadCountsByModule } from "./notifications-actions";
import { getUserPermissionsForSession } from "../admin/user-access-actions";
import { hasPermission, ModulePermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import DashboardTabLink from "./DashboardTabLink";
import { prisma } from "@/lib/prisma";

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

  // Get company settings for logo
  let companyLogoUrl = "";
  try {
    const companySettings = await prisma.companySettings.findFirst();
    companyLogoUrl = companySettings?.logoUrl || "";
  } catch (error) {
    console.error("Error fetching company settings:", error);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Header */}
      <header className="bg-white shadow-md border-b border-gray-200 relative z-20">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Company Logo */}
            {companyLogoUrl ? (
              <div className="flex-shrink-0 h-12 w-auto max-w-[200px]">
                <img 
                  src={companyLogoUrl} 
                  alt="Company Logo" 
                  className="h-full w-auto object-contain"
                />
              </div>
            ) : (
              <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">EP</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Employee Portal</h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Welcome back, {user?.name}</p>
            </div>
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
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10 mb-8 text-white relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>
          
          <div className="relative z-10 flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 break-words">
                {greeting}, {user?.name}! 👋
              </h2>
              <p className="text-blue-100 text-base sm:text-lg lg:text-xl mb-4 font-medium">
                Ready to make today productive?
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold border border-white/30">
                  {role}
                </span>
                <span className="text-blue-100 hidden sm:inline text-lg">•</span>
                <span className="text-blue-100 text-sm sm:text-base break-all">{user?.email}</span>
              </div>
            </div>
            <div className="text-4xl sm:text-5xl lg:text-7xl flex-shrink-0 opacity-90">
              {role === "ADMIN" ? "👑" : role === "MANAGER" ? "📊" : "💼"}
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mb-6 sm:mb-8">
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

