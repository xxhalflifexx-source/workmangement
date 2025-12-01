"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import ChangePasswordModal from "./ChangePasswordModal";
import { broadcastSessionEvent } from "@/lib/session-sync";

interface UserMenuProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
}

export default function UserMenu({ userName, userEmail }: UserMenuProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const handleSignOut = async () => {
    // Broadcast sign out to other tabs
    broadcastSessionEvent("signout");
    
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 min-h-[44px]"
          aria-label="User menu"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            {userName?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className="hidden sm:inline text-gray-900">{userName || "User"}</span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${showDropdown ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">{userName || "User"}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
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

