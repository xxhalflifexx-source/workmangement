import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { formatDateShort } from "@/lib/date-utils";
import HeaderLeft from "./HeaderLeft";
import HeaderRight from "./HeaderRight";
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
      {/* Top Header Bar - Black Background */}
      <header className="bg-black border-b-2 border-[#001f3f] shadow-lg sticky top-0 z-50">
        <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4 lg:py-5 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0">
            <HeaderLeft 
              userName={user?.name} 
              userEmail={user?.email}
              userRole={role}
            />
          </div>
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 justify-end">
            <div className="flex-shrink-0">
              <HeaderRight 
                initialNotifications={notifications as any}
                initialUnreadCount={unreadCount}
              />
            </div>
            {companyLogoUrl ? (
              <div className="h-12 sm:h-18 lg:h-22 xl:h-26 w-auto max-w-[200px] sm:max-w-[280px] lg:max-w-[360px] xl:max-w-[440px] flex-shrink-0">
                <img 
                  src={companyLogoUrl} 
                  alt="Company Logo" 
                  className="h-full w-auto object-contain"
                />
              </div>
            ) : (
              <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-white truncate">{companyName}</h1>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Professional Design */}
      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-[calc(100vh-80px)]">
        {/* Quick Actions Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-5 pb-3 border-b-2 border-[#001f3f]">
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
    </main>
  );
}
