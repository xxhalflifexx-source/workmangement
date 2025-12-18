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
import Link from "next/link";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }
  
  const user = session.user;
  const role = (user as any)?.role || "EMPLOYEE";

  // Get user permissions
  const permissionsRes = await getUserPermissionsForSession();
  const permissions = permissionsRes.ok ? permissionsRes.permissions : null;

  // Load notifications
  const notificationsRes = await getNotifications();
  const notifications = notificationsRes.ok && notificationsRes.notifications ? notificationsRes.notifications : [];
  const unreadCount = notificationsRes.ok ? (notificationsRes.unreadCount || 0) : 0;

  // Get unread counts by module
  const unreadCountsRes = await getUnreadCountsByModule();
  const unreadCounts = unreadCountsRes.ok && unreadCountsRes.counts ? unreadCountsRes.counts : {};

  // Get company settings for logo
  let companyLogoUrl = "";
  let companyName = "Employee Portal";
  try {
    const companySettings = await prisma.companySettings.findFirst();
    companyLogoUrl = companySettings?.logoUrl || "";
    companyName = companySettings?.companyName || "Employee Portal";
  } catch (error) {
    console.error("Error fetching company settings:", error);
  }

  // Categorize notifications for display
  const pendingNotifications = notifications.filter((n: any) => !n.isRead && n.type === "PENDING").length;
  const approvedNotifications = notifications.filter((n: any) => !n.isRead && n.type === "APPROVED").length;
  const rejectedNotifications = notifications.filter((n: any) => !n.isRead && (n.type === "REJECTED" || n.type === "CANCELLED")).length;
  const draftNotifications = notifications.filter((n: any) => !n.isRead && n.type === "DRAFT").length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top Header Bar - Mobile Optimized */}
      <header className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-50">
        <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {companyLogoUrl ? (
              <div className="h-8 sm:h-10 w-auto max-w-[140px] sm:max-w-[180px] flex-shrink-0">
                <img 
                  src={companyLogoUrl} 
                  alt="Company Logo" 
                  className="h-full w-auto object-contain"
                />
              </div>
            ) : (
              <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{companyName}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <DashboardHeaderActions
              userName={user?.name}
              userEmail={user?.email}
              userRole={role}
              initialNotifications={notifications as any}
              initialUnreadCount={unreadCount}
            />
          </div>
        </div>
      </header>

      {/* Main Content - Mobile Optimized */}
      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Quick Actions/Modules */}
          <div className="lg:col-span-2 order-1 lg:order-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-300">
                QUICK ACTIONS
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
          </div>

          {/* Right Column - Notifications */}
          <div className="lg:col-span-1 order-2 lg:order-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-300">
                NOTIFICATIONS
              </h2>
              <div className="space-y-2.5 sm:space-y-3">
                {/* Pending/In Route */}
                <Link 
                  href="/notifications?filter=pending"
                  className="block bg-orange-500 active:bg-orange-600 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="text-xl sm:text-2xl flex-shrink-0">⬇️</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs sm:text-sm truncate">IN ROUTE</div>
                        <div className="text-[10px] sm:text-xs text-orange-100 line-clamp-1">Items waiting for checking</div>
                      </div>
                    </div>
                    <div className="bg-white text-orange-600 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                      {pendingNotifications}
                    </div>
                  </div>
                </Link>

                {/* Rejected/Cancelled */}
                <Link 
                  href="/notifications?filter=rejected"
                  className="block bg-gray-800 active:bg-gray-900 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="text-xl sm:text-2xl flex-shrink-0">⬇️</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs sm:text-sm truncate">DISAPPROVED/CANCELLED</div>
                        <div className="text-[10px] sm:text-xs text-gray-300 line-clamp-1">Disapproved items</div>
                      </div>
                    </div>
                    <div className="bg-white text-gray-800 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                      {rejectedNotifications}
                    </div>
                  </div>
                </Link>

                {/* Drafts/Return */}
                <Link 
                  href="/notifications?filter=draft"
                  className="block bg-red-600 active:bg-red-700 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="text-xl sm:text-2xl flex-shrink-0">⬇️</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs sm:text-sm truncate">DRAFTS/RETURN</div>
                        <div className="text-[10px] sm:text-xs text-red-100 line-clamp-1">Return items from checker</div>
                      </div>
                    </div>
                    <div className="bg-white text-red-600 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                      {draftNotifications}
                    </div>
                  </div>
                </Link>

                {/* Approved */}
                <Link 
                  href="/notifications?filter=approved"
                  className="block bg-green-600 active:bg-green-700 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="text-xl sm:text-2xl flex-shrink-0">⬇️</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs sm:text-sm truncate">APPROVED</div>
                        <div className="text-[10px] sm:text-xs text-green-100 line-clamp-1">Approved Items</div>
                      </div>
                    </div>
                    <div className="bg-white text-green-600 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                      {approvedNotifications}
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
