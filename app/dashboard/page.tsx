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
import DashboardWrapper from "./DashboardWrapper";
import { cookies, headers } from "next/headers";
import DashboardSessionGuard from "./DashboardSessionGuard";

// Mark this page as dynamic since it uses getServerSession which accesses headers/cookies
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  console.log("[Dashboard] Server component starting...");
  
  try {
    // Debug: Check cookies and environment variables
    const cookieStore = await cookies();
    const headersList = await headers();
    const cookieHeader = headersList.get("cookie") || "";
    
    // Check for NextAuth session cookie
    const sessionCookieName = process.env.NODE_ENV === "production" 
      ? "__Secure-next-auth.session-token" 
      : "next-auth.session-token";
    const sessionCookie = cookieStore.get(sessionCookieName) || cookieStore.get("next-auth.session-token");
    
    console.log("[Dashboard] Cookie check:");
    console.log("[Dashboard] - Session cookie present:", sessionCookie ? "Yes" : "No");
    console.log("[Dashboard] - Cookie name searched:", sessionCookieName);
    console.log("[Dashboard] - All cookie names:", cookieStore.getAll().map(c => c.name).join(", "));
    console.log("[Dashboard] - Cookie header present:", cookieHeader ? "Yes" : "No");
    console.log("[Dashboard] - Cookie header length:", cookieHeader.length);
    
    // Check environment variables (without exposing secrets)
    console.log("[Dashboard] Environment check:");
    console.log("[Dashboard] - NEXTAUTH_SECRET present:", process.env.NEXTAUTH_SECRET ? "Yes" : "No");
    console.log("[Dashboard] - NEXTAUTH_SECRET length:", process.env.NEXTAUTH_SECRET?.length || 0);
    console.log("[Dashboard] - NEXTAUTH_URL:", process.env.NEXTAUTH_URL || "Not set");
    console.log("[Dashboard] - NODE_ENV:", process.env.NODE_ENV);
    
    const session = await getServerSession(authOptions);
    console.log("[Dashboard] Session check result:");
    console.log("[Dashboard] - Session found:", session ? "Yes" : "No");
    console.log("[Dashboard] - Session user email:", session?.user?.email || "None");
    console.log("[Dashboard] - Session user id:", (session?.user as any)?.id || "None");
    console.log("[Dashboard] - Session user role:", (session?.user as any)?.role || "None");
    
    if (!session?.user) {
      console.log("[Dashboard] ERROR: No session found");
      console.log("[Dashboard] - This may indicate cookie not set or not readable");
      console.log("[Dashboard] - Allowing client-side check to handle this (may be cookie propagation delay)");
      // Don't immediately redirect - let client-side session guard handle it
      // This prevents redirect loop if cookie is still propagating
    }
    
    // Additional validation - if session exists but user data is incomplete
    if (session?.user && !session.user.email) {
      console.error("[Dashboard] Session exists but user email missing - redirecting to login");
      redirect("/login");
    }
    
    // If no session, return a component that will check client-side
    if (!session?.user) {
      return (
        <DashboardWrapper>
          <DashboardSessionGuard>
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Checking session...</p>
              </div>
            </div>
          </DashboardSessionGuard>
        </DashboardWrapper>
      );
    }
    
    console.log("[Dashboard] User:", session.user.email);
  
  const user = session.user;
  const role = (user as any)?.role || "EMPLOYEE";
  const isSuperAdmin = (user as any)?.isSuperAdmin || false;
  const organizationName = (user as any)?.organizationName || null;

  // Get user permissions - wrap in try-catch to prevent crashes
  let permissions = null;
  try {
    const permissionsRes = await getUserPermissionsForSession();
    permissions = permissionsRes.ok ? permissionsRes.permissions : null;
  } catch (error) {
    console.error("[Dashboard] Error getting permissions:", error);
  }

  // Load notifications - wrap in try-catch to prevent crashes
  let notifications: any[] = [];
  let unreadCount = 0;
  try {
    const notificationsRes = await getNotifications();
    notifications = notificationsRes.ok && notificationsRes.notifications ? notificationsRes.notifications : [];
    unreadCount = notificationsRes.ok ? (notificationsRes.unreadCount || 0) : 0;
  } catch (error) {
    console.error("[Dashboard] Error getting notifications:", error);
  }

  // Get unread counts by module - wrap in try-catch to prevent crashes
  let unreadCounts: Record<string, number> = {};
  try {
    const unreadCountsRes = await getUnreadCountsByModule();
    unreadCounts = unreadCountsRes.ok && unreadCountsRes.counts ? unreadCountsRes.counts : {};
  } catch (error) {
    console.error("[Dashboard] Error getting unread counts:", error);
  }

  // Get company settings for logo
  // Simplified query to avoid Prisma type issues - will show first available settings
  let companyLogoUrl = "";
  let companyName = "Employee Portal";
  try {
    // Check if companySettings model exists before querying
    if (prisma && typeof (prisma as any).companySettings !== 'undefined') {
      const companySettings = await (prisma as any).companySettings.findFirst().catch(() => null);
      if (companySettings) {
        companyLogoUrl = companySettings.logoUrl || "";
        companyName = companySettings.companyName || "Employee Portal";
      }
    }
  } catch (error) {
    console.error("[Dashboard] Error fetching company settings:", error);
    // Use defaults - page will still render
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

    console.log("[Dashboard] Rendering dashboard content with session");
    
    return (
      <DashboardWrapper>
        <DashboardSessionGuard>
        <main className="min-h-screen bg-gray-50">
      {/* Top Header Bar - Black Background */}
      <header className="bg-gray-900 border-b border-gray-800 shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-opacity-95">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 lg:py-4 flex justify-between items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 min-w-0">
            <HeaderLeft 
              userName={user?.name} 
              userEmail={user?.email}
              userRole={role}
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 justify-end">
            <div className="flex-shrink-0">
              <HeaderRight 
                initialNotifications={notifications as any}
                initialUnreadCount={unreadCount}
              />
            </div>
            {companyLogoUrl ? (
              <div className="h-10 sm:h-12 md:h-14 lg:h-16 w-auto max-w-[180px] sm:max-w-[220px] md:max-w-[260px] lg:max-w-[300px] flex-shrink-0">
                <img 
                  src={companyLogoUrl} 
                  alt="Company Logo" 
                  className="h-full w-auto object-contain"
                />
              </div>
            ) : (
              <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-white truncate">{companyName}</h1>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Professional Design */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-gradient-to-br from-gray-50 via-white to-gray-50 min-h-[calc(100vh-80px)]">
        {/* Quick Actions Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-200">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
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

                {/* Super Admin Panel - Only for Super Admins */}
                {isSuperAdmin && (
                  <DashboardTabLink
                    href="/super-admin"
                    icon="👑"
                    title="Super Admin"
                    description="Manage organizations"
                    className="hover:border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50"
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

                {/* Incident Reports - Check permission */}
                {(role === "ADMIN" || (permissions && hasPermission(permissions, "incidentReports"))) && (
                  <DashboardTabLink
                    href="/incident-reports"
                    icon="⚠️"
                    title="Incident Reports"
                    description="Workplace safety incidents"
                    notificationCount={unreadCounts["/incident-reports"] || 0}
                    className="hover:border-red-300"
                  />
                )}
              </div>
            </div>
      </div>
    </main>
        </DashboardSessionGuard>
      </DashboardWrapper>
    );
  } catch (error: any) {
    console.error("[Dashboard] Server component error:", error);
    console.error("[Dashboard] Error message:", error?.message);
    console.error("[Dashboard] Error stack:", error?.stack);
    
    // Instead of throwing, return a basic error page so user can still navigate
    return (
      <DashboardWrapper>
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg border border-red-200 p-8 max-w-lg text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Error</h1>
            <p className="text-gray-600 mb-4">
              There was an error loading the dashboard. Please try refreshing the page.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              If the problem persists, please contact support.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Return to Login
            </Link>
          </div>
        </main>
      </DashboardWrapper>
    );
  }
}
