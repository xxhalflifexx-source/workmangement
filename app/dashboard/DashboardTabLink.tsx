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
      className={`group bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md active:shadow-sm transition-all duration-200 hover:border-blue-400 active:border-blue-500 active:scale-[0.97] flex flex-col items-center justify-center text-center min-h-[90px] sm:min-h-[100px] relative overflow-hidden touch-manipulation ${className}`}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/0 group-hover:from-blue-50/30 group-hover:to-transparent group-active:from-blue-50/40 transition-all duration-200"></div>
      
      <div className="relative z-10 inline-block">
        <div className="text-xl sm:text-2xl lg:text-3xl mb-1.5 sm:mb-2 transform group-hover:scale-105 group-active:scale-100 transition-transform duration-200">{icon}</div>
        <NotificationBadge count={notificationCount} />
      </div>
      <div className="relative z-10 font-semibold text-[11px] sm:text-xs lg:text-sm text-gray-900 group-hover:text-blue-700 group-active:text-blue-800 transition-colors duration-200 leading-tight">{title}</div>
      <div className="relative z-10 text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 group-hover:text-gray-600 group-active:text-gray-700 transition-colors duration-200 line-clamp-2 leading-tight">{description}</div>
    </Link>
  );
}

