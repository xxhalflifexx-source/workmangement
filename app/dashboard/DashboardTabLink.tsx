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
      className={`group bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all duration-200 hover:border-blue-400 hover:-translate-y-0.5 active:scale-[0.98] flex flex-col items-center justify-center text-center min-h-[100px] relative overflow-hidden ${className}`}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/0 group-hover:from-blue-50/30 group-hover:to-transparent transition-all duration-200"></div>
      
      <div className="relative z-10 inline-block">
        <div className="text-2xl sm:text-3xl mb-2 transform group-hover:scale-105 transition-transform duration-200">{icon}</div>
        <NotificationBadge count={notificationCount} />
      </div>
      <div className="relative z-10 font-semibold text-xs sm:text-sm text-gray-900 group-hover:text-blue-700 transition-colors duration-200">{title}</div>
      <div className="relative z-10 text-xs text-gray-500 mt-1 group-hover:text-gray-600 transition-colors duration-200">{description}</div>
    </Link>
  );
}

