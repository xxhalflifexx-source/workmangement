import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import { formatDateShort } from "@/lib/date-utils";
import UserMenu from "./UserMenu";
import NotificationsDropdown from "./NotificationsDropdown";
import { getNotifications } from "./notifications-actions";
import DashboardLinks from "./DashboardLinks";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = (user as any)?.role || "EMPLOYEE";

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
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Employee Portal</h1>
            <p className="text-xs sm:text-sm text-gray-500">Welcome back, {user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsDropdown 
              initialNotifications={notifications as any}
              initialUnreadCount={unreadCount}
            />
            <UserMenu userName={user?.name} userEmail={user?.email} />
          </div>
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

        {/* Quick Actions Grid - Access-controlled */}
        <DashboardLinks />

        {/* Quick Info Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 border border-gray-200">
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
      </div>
    </main>
  );
}

