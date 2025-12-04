"use client";

import { useState } from "react";
import UserMenu from "./UserMenu";
import NotificationsDropdown from "./NotificationsDropdown";

interface DashboardHeaderActionsProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  initialNotifications?: any[];
  initialUnreadCount?: number;
}

export default function DashboardHeaderActions({
  userName,
  userEmail,
  initialNotifications,
  initialUnreadCount,
}: DashboardHeaderActionsProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 flex-shrink-0 relative z-30">
      <NotificationsDropdown 
        initialNotifications={initialNotifications}
        initialUnreadCount={initialUnreadCount}
        onOpenChange={setNotificationsOpen}
      />
      <UserMenu 
        userName={userName} 
        userEmail={userEmail}
        hideWhenNotificationsOpen={true}
        notificationsOpen={notificationsOpen}
      />
    </div>
  );
}

