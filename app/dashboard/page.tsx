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
      {/* Top Header Bar */}
      <header className="bg-white border-b border-gray-300 shadow-sm">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {companyLogoUrl ? (
              <div className="h-10 w-auto max-w-[180px]">
                <img 
                  src={companyLogoUrl} 
                  alt="Company Logo" 
                  className="h-full w-auto object-contain"
                />
              </div>
            ) : (
              <h1 className="text-lg font-semibold text-gray-900">{companyName}</h1>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 font-medium">
              Welcome {user?.name?.toUpperCase()}!
            </span>
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

      {/* Main Content - Two Column Layout */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Notifications */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-300">
                NOTIFICATIONS
              </h2>
              <div className="space-y-3">
                {/* Pending/In Route */}
                <Link 
                  href="/notifications?filter=pending"
                  className="block bg-orange-500 hover:bg-orange-600 rounded-lg p-4 text-white transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">⬇️</div>
                      <div>
                        <div className="font-semibold text-sm">IN ROUTE</div>
                        <div className="text-xs text-orange-100">Items waiting for checking</div>
                      </div>
                    </div>
                    <div className="bg-white text-orange-600 rounded px-3 py-1 font-bold text-sm min-w-[32px] text-center">
                      {pendingNotifications}
                    </div>
                  </div>
                </Link>

                {/* Rejected/Cancelled */}
                <Link 
                  href="/notifications?filter=rejected"
                  className="block bg-gray-800 hover:bg-gray-900 rounded-lg p-4 text-white transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">⬇️</div>
                      <div>
                        <div className="font-semibold text-sm">DISAPPROVED/CANCELLED</div>
                        <div className="text-xs text-gray-300">Disapproved items</div>
                      </div>
                    </div>
                    <div className="bg-white text-gray-800 rounded px-3 py-1 font-bold text-sm min-w-[32px] text-center">
                      {rejectedNotifications}
                    </div>
                  </div>
                </Link>

                {/* Drafts/Return */}
                <Link 
                  href="/notifications?filter=draft"
                  className="block bg-red-600 hover:bg-red-700 rounded-lg p-4 text-white transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">⬇️</div>
                      <div>
                        <div className="font-semibold text-sm">DRAFTS/RETURN</div>
                        <div className="text-xs text-red-100">Return items from checker</div>
                      </div>
                    </div>
                    <div className="bg-white text-red-600 rounded px-3 py-1 font-bold text-sm min-w-[32px] text-center">
                      {draftNotifications}
                    </div>
                  </div>
                </Link>

                {/* Approved */}
                <Link 
                  href="/notifications?filter=approved"
                  className="block bg-green-600 hover:bg-green-700 rounded-lg p-4 text-white transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">⬇️</div>
                      <div>
                        <div className="font-semibold text-sm">APPROVED</div>
                        <div className="text-xs text-green-100">Approved Items</div>
                      </div>
                    </div>
                    <div className="bg-white text-green-600 rounded px-3 py-1 font-bold text-sm min-w-[32px] text-center">
                      {approvedNotifications}
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column - Quick Actions/Modules */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-300">
                QUICK ACTIONS
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
        </div>
      </div>
    </main>
  );
}
