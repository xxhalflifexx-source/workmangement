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
      className={`group bg-white rounded-xl shadow-md border border-gray-200 p-5 sm:p-6 hover:shadow-xl transition-all duration-300 hover:border-blue-400 hover:-translate-y-1.5 active:scale-[0.98] flex flex-col items-center justify-center text-center min-h-[110px] sm:min-h-[130px] relative overflow-hidden ${className}`}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/0 group-hover:from-blue-50/50 group-hover:to-transparent transition-all duration-300"></div>
      
      <div className="relative z-10 inline-block">
        <div className="text-3xl sm:text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-300">{icon}</div>
        <NotificationBadge count={notificationCount} />
      </div>
      <div className="relative z-10 font-bold text-sm sm:text-base text-gray-900 group-hover:text-blue-700 transition-colors duration-300">{title}</div>
      <div className="relative z-10 text-xs text-gray-600 mt-1.5 group-hover:text-gray-700 transition-colors duration-300">{description}</div>
    </Link>
  );
}

