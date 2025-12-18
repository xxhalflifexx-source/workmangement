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

  // Categorize notifications by their module/responsibility (linkUrl)
  const getNotificationsByModule = (modulePath: string) => {
    return notifications.filter((n: any) => !n.isRead && n.linkUrl && n.linkUrl.startsWith(modulePath)).length;
  };

  // Count notifications by module
  const jobNotifications = getNotificationsByModule("/jobs");
  const financeNotifications = getNotificationsByModule("/finance");
  const inventoryNotifications = getNotificationsByModule("/inventory");
  const qcNotifications = getNotificationsByModule("/qc");
  const hrNotifications = getNotificationsByModule("/hr");
  const timeClockNotifications = getNotificationsByModule("/time-clock");
  const timeRecordsNotifications = getNotificationsByModule("/time-records");
  const adminNotifications = getNotificationsByModule("/admin");
  
  // Total counts for each category
  const pendingNotifications = notifications.filter((n: any) => !n.isRead && n.type === "PENDING").length;
  const approvedNotifications = notifications.filter((n: any) => !n.isRead && n.type === "APPROVED").length;
  const rejectedNotifications = notifications.filter((n: any) => !n.isRead && (n.type === "REJECTED" || n.type === "CANCELLED")).length;
  const draftNotifications = notifications.filter((n: any) => !n.isRead && n.type === "DRAFT").length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top Header Bar - Mobile Optimized */}
      <header className="bg-white border-b-2 border-[#001f3f] shadow-sm sticky top-0 z-50">
        <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <DashboardHeaderActions
              userName={user?.name}
              userEmail={user?.email}
              userRole={role}
              initialNotifications={notifications as any}
              initialUnreadCount={unreadCount}
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 justify-end">
            {companyLogoUrl ? (
              <div className="h-12 sm:h-16 lg:h-20 w-auto max-w-[200px] sm:max-w-[280px] lg:max-w-[350px] flex-shrink-0">
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
        </div>
      </header>

      {/* Main Content - Mobile Optimized */}
      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Quick Actions/Modules */}
          <div className="lg:col-span-2 order-1 lg:order-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 pb-2 border-b-2 border-[#001f3f]">
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
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 pb-2 border-b-2 border-[#001f3f]">
                NOTIFICATIONS
              </h2>
              <div className="space-y-2.5 sm:space-y-3">
                {/* Job Management Notifications */}
                {(role === "ADMIN" || (permissions && hasPermission(permissions, "jobManagement"))) && jobNotifications > 0 && (
                  <Link 
                    href="/jobs"
                    className="block bg-blue-600 active:bg-blue-700 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="text-xl sm:text-2xl flex-shrink-0">📋</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs sm:text-sm truncate">JOB MANAGEMENT</div>
                          <div className="text-[10px] sm:text-xs text-blue-100 line-clamp-1">Job-related notifications</div>
                        </div>
                      </div>
                      <div className="bg-white text-blue-600 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                        {jobNotifications}
                      </div>
                    </div>
                  </Link>
                )}

                {/* Finance Notifications */}
                {(role === "ADMIN" || (permissions && hasPermission(permissions, "finance"))) && financeNotifications > 0 && (
                  <Link 
                    href="/finance"
                    className="block bg-green-600 active:bg-green-700 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="text-xl sm:text-2xl flex-shrink-0">💰</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs sm:text-sm truncate">FINANCE</div>
                          <div className="text-[10px] sm:text-xs text-green-100 line-clamp-1">Invoice & payment notifications</div>
                        </div>
                      </div>
                      <div className="bg-white text-green-600 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                        {financeNotifications}
                      </div>
                    </div>
                  </Link>
                )}

                {/* Inventory Notifications */}
                {(role === "ADMIN" || (permissions && hasPermission(permissions, "inventory"))) && inventoryNotifications > 0 && (
                  <Link 
                    href="/inventory"
                    className="block bg-orange-500 active:bg-orange-600 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="text-xl sm:text-2xl flex-shrink-0">📦</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs sm:text-sm truncate">INVENTORY</div>
                          <div className="text-[10px] sm:text-xs text-orange-100 line-clamp-1">Material request notifications</div>
                        </div>
                      </div>
                      <div className="bg-white text-orange-600 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                        {inventoryNotifications}
                      </div>
                    </div>
                  </Link>
                )}

                {/* Quality Control Notifications */}
                {(role === "ADMIN" || (permissions && hasPermission(permissions, "qualityControl"))) && qcNotifications > 0 && (
                  <Link 
                    href="/qc"
                    className="block bg-purple-600 active:bg-purple-700 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="text-xl sm:text-2xl flex-shrink-0">✅</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs sm:text-sm truncate">QUALITY CONTROL</div>
                          <div className="text-[10px] sm:text-xs text-purple-100 line-clamp-1">QC review notifications</div>
                        </div>
                      </div>
                      <div className="bg-white text-purple-600 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                        {qcNotifications}
                      </div>
                    </div>
                  </Link>
                )}

                {/* HR Notifications */}
                {(role === "ADMIN" || (permissions && hasPermission(permissions, "hr"))) && hrNotifications > 0 && (
                  <Link 
                    href="/hr"
                    className="block bg-indigo-600 active:bg-indigo-700 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="text-xl sm:text-2xl flex-shrink-0">👥</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs sm:text-sm truncate">HR</div>
                          <div className="text-[10px] sm:text-xs text-indigo-100 line-clamp-1">HR-related notifications</div>
                        </div>
                      </div>
                      <div className="bg-white text-indigo-600 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                        {hrNotifications}
                      </div>
                    </div>
                  </Link>
                )}

                {/* Time Clock Notifications */}
                {(role === "ADMIN" || (permissions && hasPermission(permissions, "timeClock"))) && timeClockNotifications > 0 && (
                  <Link 
                    href="/time-clock"
                    className="block bg-teal-600 active:bg-teal-700 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="text-xl sm:text-2xl flex-shrink-0">⏰</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs sm:text-sm truncate">TIME CLOCK</div>
                          <div className="text-[10px] sm:text-xs text-teal-100 line-clamp-1">Time clock notifications</div>
                        </div>
                      </div>
                      <div className="bg-white text-teal-600 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                        {timeClockNotifications}
                      </div>
                    </div>
                  </Link>
                )}

                {/* Time Records Notifications */}
                {(role === "ADMIN" || role === "MANAGER" || role === "EMPLOYEE") && timeRecordsNotifications > 0 && (
                  <Link 
                    href="/time-records"
                    className="block bg-cyan-600 active:bg-cyan-700 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="text-xl sm:text-2xl flex-shrink-0">📒</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs sm:text-sm truncate">TIME RECORDS</div>
                          <div className="text-[10px] sm:text-xs text-cyan-100 line-clamp-1">Time record notifications</div>
                        </div>
                      </div>
                      <div className="bg-white text-cyan-600 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                        {timeRecordsNotifications}
                      </div>
                    </div>
                  </Link>
                )}

                {/* Admin Panel Notifications */}
                {(role === "ADMIN" || (permissions && hasPermission(permissions, "adminPanel"))) && adminNotifications > 0 && (
                  <Link 
                    href="/admin"
                    className="block bg-gray-800 active:bg-gray-900 rounded-lg p-3.5 sm:p-4 text-white transition-colors touch-manipulation"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="text-xl sm:text-2xl flex-shrink-0">⚙️</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs sm:text-sm truncate">ADMIN PANEL</div>
                          <div className="text-[10px] sm:text-xs text-gray-300 line-clamp-1">Admin notifications</div>
                        </div>
                      </div>
                      <div className="bg-white text-gray-800 rounded px-2.5 sm:px-3 py-1 font-bold text-xs sm:text-sm min-w-[28px] sm:min-w-[32px] text-center flex-shrink-0">
                        {adminNotifications}
                      </div>
                    </div>
                  </Link>
                )}

                {/* Show message if no notifications */}
                {jobNotifications === 0 && financeNotifications === 0 && inventoryNotifications === 0 && 
                 qcNotifications === 0 && hrNotifications === 0 && timeClockNotifications === 0 && 
                 timeRecordsNotifications === 0 && adminNotifications === 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    No unread notifications
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
