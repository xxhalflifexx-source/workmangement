"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import ChangePasswordModal from "./ChangePasswordModal";
import { broadcastSessionEvent } from "@/lib/session-sync";

interface UserMenuProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  hideWhenNotificationsOpen?: boolean;
  notificationsOpen?: boolean;
}

export default function UserMenu({ userName, userEmail, hideWhenNotificationsOpen, notificationsOpen }: UserMenuProps) {
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

  // Hide UserMenu when notifications dropdown is open
  if (hideWhenNotificationsOpen && notificationsOpen) {
    return null;
  }

  return (
    <>
      <div className="relative z-30" ref={dropdownRef}>
        <button
          ref={buttonRef}
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 min-h-[44px]"
          aria-label="User menu"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {userName?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className="hidden sm:inline text-gray-900 truncate">{userName || "User"}</span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${showDropdown ? "rotate-180" : ""}`}
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
            {/* Dropdown - Use fixed positioning on mobile to avoid overlap issues */}
            <div className="fixed sm:absolute right-4 sm:right-0 top-[72px] sm:top-auto sm:mt-2 left-4 sm:left-auto w-[calc(100vw-2rem)] sm:w-48 max-w-[280px] sm:max-w-[calc(100vw-1rem)] max-h-[calc(100vh-88px)] sm:max-h-none bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[50] sm:z-[1000]">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 break-words">{userName || "User"}</p>
                <p className="text-xs text-gray-500 break-all mt-1">{userEmail}</p>
              </div>
              
              <button
                onClick={() => {
                  setShowChangePassword(true);
                  setShowDropdown(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px] flex items-center gap-2"
              >
                <span>🔒</span>
                <span>Change Password</span>
              </button>
              
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors min-h-[44px] flex items-center gap-2"
              >
                <span>🚪</span>
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

