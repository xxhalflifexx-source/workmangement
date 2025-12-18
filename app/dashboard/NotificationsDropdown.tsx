"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "./notifications-actions";
import { formatDateTime, formatDateShort } from "@/lib/date-utils";

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  isRead: boolean;
  linkUrl: string | null;
  createdAt: string;
}

interface NotificationsDropdownProps {
  initialNotifications?: Notification[];
  initialUnreadCount?: number;
  onUserMenuClose?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export default function NotificationsDropdown({ 
  initialNotifications = [], 
  initialUnreadCount = 0,
  onUserMenuClose,
  onOpenChange
}: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load notifications when dropdown opens
  useEffect(() => {
    if (showDropdown) {
      loadNotifications();
    }
  }, [showDropdown]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadNotifications();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await getNotifications();
      if (res.ok && res.notifications) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        if (onOpenChange) {
          onOpenChange(false);
        }
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown, onOpenChange]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      const res = await markNotificationAsRead(notification.id);
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    }

    if (notification.linkUrl) {
      router.push(notification.linkUrl);
      setShowDropdown(false);
      if (onOpenChange) {
        onOpenChange(false);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    const res = await markAllNotificationsAsRead();
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "WARNING":
        return "⚠️";
      case "SUCCESS":
        return "✅";
      case "ERROR":
        return "❌";
      case "JOB_UPDATE":
        return "📋";
      default:
        return "ℹ️";
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      return formatDateShort(dateString);
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="relative z-30" ref={dropdownRef}>
      <button
        onClick={() => {
          const newState = !showDropdown;
          setShowDropdown(newState);
          if (onOpenChange) {
            onOpenChange(newState);
          }
          if (newState && onUserMenuClose) {
            onUserMenuClose();
          }
        }}
        className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 bg-black/20 z-[40] sm:hidden"
            onClick={() => {
              setShowDropdown(false);
              if (onOpenChange) {
                onOpenChange(false);
              }
            }}
          />
          {/* Dropdown - Matching UserMenu style */}
          <div className="fixed sm:absolute right-4 sm:right-0 top-[72px] sm:top-full sm:mt-2 left-4 sm:left-auto w-[calc(100vw-2rem)] sm:w-72 max-w-[320px] sm:max-w-none max-h-[calc(100vh-88px)] sm:max-h-none bg-white rounded-xl shadow-2xl border-2 border-gray-200 py-2 z-[50] sm:z-[1000] dropdown-enter flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-600">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1 min-h-0 max-h-[calc(100vh-200px)] sm:max-h-[500px]">
              {loading ? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No notifications
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation ${
                        !notification.isRead ? "bg-blue-50/30" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm break-words ${
                                !notification.isRead
                                  ? "font-semibold text-gray-900"
                                  : "font-medium text-gray-700"
                              }`}
                            >
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          {notification.message && (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2 break-words" title={notification.message || undefined}>
                              {notification.message}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

