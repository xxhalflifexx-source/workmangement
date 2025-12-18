"use client";

import NotificationsDropdown from "./NotificationsDropdown";

interface HeaderRightProps {
  initialNotifications?: any[];
  initialUnreadCount?: number;
}

export default function HeaderRight({ initialNotifications, initialUnreadCount }: HeaderRightProps) {
  return (
    <NotificationsDropdown 
      initialNotifications={initialNotifications}
      initialUnreadCount={initialUnreadCount}
    />
  );
}

