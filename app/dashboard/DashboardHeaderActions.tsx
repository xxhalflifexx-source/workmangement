"use client";

import { useState } from "react";
import UserMenu from "./UserMenu";
import NotificationsDropdown from "./NotificationsDropdown";

interface DashboardHeaderActionsProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  userRole?: string;
  initialNotifications?: any[];
  initialUnreadCount?: number;
  showOnlyNotifications?: boolean;
}

export default function DashboardHeaderActions({
  userName,
  userEmail,
  userRole,
  initialNotifications,
  initialUnreadCount,
  showOnlyNotifications = false,
}: DashboardHeaderActionsProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  if (showOnlyNotifications) {
    return (
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 relative z-30">
        <NotificationsDropdown 
          initialNotifications={initialNotifications}
          initialUnreadCount={initialUnreadCount}
          onOpenChange={setNotificationsOpen}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 relative z-30">
      <UserMenu 
        userName={userName} 
        userEmail={userEmail}
        userRole={userRole}
        hideWhenNotificationsOpen={true}
        notificationsOpen={notificationsOpen}
      />
      <NotificationsDropdown 
        initialNotifications={initialNotifications}
        initialUnreadCount={initialUnreadCount}
        onOpenChange={setNotificationsOpen}
      />
    </div>
  );
}

