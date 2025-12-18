"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import ChangePasswordModal from "./ChangePasswordModal";
import { broadcastSessionEvent } from "@/lib/session-sync";

interface UserMenuProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  userRole?: string;
  hideWhenNotificationsOpen?: boolean;
  notificationsOpen?: boolean;
}

export default function UserMenu({ userName, userEmail, userRole, hideWhenNotificationsOpen, notificationsOpen }: UserMenuProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      // Prevent body scroll when dropdown is open on mobile
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "";
    };
  }, [showDropdown]);

  const handleSignOut = async () => {
    // Broadcast sign out to other tabs
    broadcastSessionEvent("signout");
    
    await signOut({ callbackUrl: "/login" });
  };

  // On mobile, hide UserMenu when notifications dropdown is open to save space
  // On desktop, keep it visible
  const shouldHideOnMobile = hideWhenNotificationsOpen && notificationsOpen;

  return (
    <>
      <div className={`relative z-30 ${shouldHideOnMobile ? 'hidden sm:block' : ''}`} ref={dropdownRef}>
        <button
          ref={buttonRef}
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium text-white min-h-[44px]"
          aria-label="User menu"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {userName?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className="hidden sm:inline text-white truncate">{userName || "User"}</span>
          <svg
            className={`w-4 h-4 text-gray-300 transition-transform flex-shrink-0 ${showDropdown ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDropdown && (
          <>
            {/* Backdrop for mobile */}
            <div 
              className="fixed inset-0 bg-black/20 z-[40] sm:hidden"
              onClick={() => setShowDropdown(false)}
            />
            {/* Dropdown - Positioned to align with button */}
            <div className="fixed sm:absolute left-4 sm:left-0 top-[72px] sm:top-full sm:mt-2 w-[calc(100vw-2rem)] sm:w-72 max-w-[320px] sm:max-w-none max-h-[calc(100vh-88px)] sm:max-h-none bg-white rounded-xl shadow-2xl border-2 border-gray-200 py-2 z-[50] sm:z-[1000] dropdown-enter">
              <div className="px-4 py-3 border-b border-gray-200">
                <p className="text-sm font-bold text-gray-900 break-words">{userName || "User"}</p>
                <p className="text-xs text-gray-600 break-all mt-1.5 font-medium">{userEmail}</p>
              </div>
              
              {/* Quick Info Section */}
              {userRole && (
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                    <span>📢</span>
                    <span>Quick Info</span>
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    <p className="flex items-start justify-between">
                      <span className="font-semibold text-gray-700">Role:</span>
                      <span className="text-blue-600 font-bold ml-2">{userRole}</span>
                    </p>
                    <p className="flex items-start justify-between">
                      <span className="font-semibold text-gray-700">Access Level:</span>
                      <span className="text-gray-600 ml-2 text-right">
                        {userRole === "ADMIN"
                          ? "Full system access"
                          : userRole === "MANAGER"
                          ? "Team management access"
                          : "Standard employee access"}
                      </span>
                    </p>
                    <p className="flex items-start justify-between">
                      <span className="font-semibold text-gray-700">Account Status:</span>
                      <span className="text-green-600 font-bold ml-2 flex items-center gap-1">
                        <span>✓</span>
                        <span>Active & Verified</span>
                      </span>
                    </p>
                  </div>
                </div>
              )}
              
              <button
                onClick={() => {
                  setShowChangePassword(true);
                  setShowDropdown(false);
                }}
                className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px] flex items-center gap-2.5 touch-manipulation"
              >
                <span className="text-base">🔒</span>
                <span>Change Password</span>
              </button>
              
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors min-h-[44px] flex items-center gap-2.5 touch-manipulation"
              >
                <span className="text-base">🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          </>
        )}
      </div>

      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </>
  );
}

