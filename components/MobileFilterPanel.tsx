"use client";

import React, { useState } from "react";

interface MobileFilterPanelProps {
  title?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Collapsible filter panel optimized for mobile
 * Collapsed by default on mobile, always open on desktop
 */
export default function MobileFilterPanel({
  title = "Filters",
  children,
  defaultOpen = false,
  className = "",
}: MobileFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Mobile: Collapsible header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden w-full px-4 py-4 flex justify-between items-center text-left"
      >
        <span className="font-medium text-gray-900">{title}</span>
        <span className={`text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {/* Desktop: Always visible header */}
      {title && (
        <div className="hidden md:block px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">{title}</h3>
        </div>
      )}

      {/* Content: Hidden on mobile when collapsed, always visible on desktop */}
      <div
        className={`
          ${isOpen ? "block" : "hidden"} md:block
          p-4 sm:p-6
        `}
      >
        {children}
      </div>
    </div>
  );
}

