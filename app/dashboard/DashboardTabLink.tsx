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
      className={`group bg-white rounded-xl shadow-md border-2 border-gray-200 p-3 sm:p-4 lg:p-5 hover:shadow-xl hover:border-blue-500 active:shadow-lg active:border-blue-600 active:scale-[0.98] flex flex-col items-center justify-center text-center min-h-[95px] sm:min-h-[110px] lg:min-h-[120px] relative overflow-hidden touch-manipulation transition-all duration-300 ${className}`}
    >
      {/* Professional gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-transparent to-transparent group-hover:from-blue-50/40 group-hover:via-blue-50/20 group-hover:to-transparent group-active:from-blue-100/30 transition-all duration-300"></div>
      
      <div className="relative z-10 inline-block">
        <div className="text-2xl sm:text-3xl lg:text-4xl mb-2 sm:mb-2.5 transform group-hover:scale-110 group-active:scale-105 transition-transform duration-300 filter group-hover:drop-shadow-md">{icon}</div>
        <NotificationBadge count={notificationCount} />
      </div>
      <div className="relative z-10 font-bold text-xs sm:text-sm lg:text-base text-gray-900 group-hover:text-blue-700 group-active:text-blue-800 transition-colors duration-300 leading-tight mt-1">{title}</div>
      <div className="relative z-10 text-[10px] sm:text-xs lg:text-sm text-gray-600 mt-1 sm:mt-1.5 group-hover:text-gray-700 group-active:text-gray-800 transition-colors duration-300 line-clamp-2 leading-tight font-medium">{description}</div>
    </Link>
  );
}

