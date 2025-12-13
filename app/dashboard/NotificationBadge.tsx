"use client";

interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export default function NotificationBadge({ count, className = "" }: NotificationBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-md ${className}`}
      style={{
        fontSize: count > 99 ? "9px" : "11px",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

