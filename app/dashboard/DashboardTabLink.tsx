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
      className={`group bg-white rounded-xl shadow-sm border border-gray-200/60 p-6 hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5 active:shadow-sm active:border-blue-400 active:translate-y-0 flex flex-col items-center justify-center text-center min-h-[140px] relative overflow-hidden touch-manipulation transition-all duration-200 ${className}`}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-transparent to-transparent group-hover:from-blue-50/30 group-hover:via-blue-50/10 group-hover:to-transparent transition-all duration-200"></div>
      
      <div className="relative z-10 inline-block">
        <div className="text-4xl sm:text-3xl lg:text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-200">{icon}</div>
        <NotificationBadge count={notificationCount} />
      </div>
      <div className="relative z-10 font-semibold text-base text-gray-900 group-hover:text-blue-600 transition-colors duration-200 leading-tight mt-2">{title}</div>
      <div className="relative z-10 text-sm text-gray-500 mt-1.5 group-hover:text-gray-600 transition-colors duration-200 line-clamp-2 leading-snug">{description}</div>
    </Link>
  );
}

