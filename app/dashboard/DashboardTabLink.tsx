"use client";

import Link from "next/link";
import NotificationBadge from "./NotificationBadge";

interface DashboardTabLinkProps {
  href: string;
  icon: string;
  title: string;
  description: string;
  notificationCount?: number;
  className?: string;
}

export default function DashboardTabLink({
  href,
  icon,
  title,
  description,
  notificationCount = 0,
  className = "",
}: DashboardTabLinkProps) {
  return (
    <Link
      href={href}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px] relative ${className}`}
    >
      <div className="relative inline-block">
        <div className="text-3xl sm:text-4xl mb-2">{icon}</div>
        <NotificationBadge count={notificationCount} />
      </div>
      <div className="font-semibold text-sm sm:text-base text-gray-900">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </Link>
  );
}

