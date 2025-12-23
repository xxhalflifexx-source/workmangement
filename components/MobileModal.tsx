"use client";

import React, { useEffect } from "react";

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

/**
 * Mobile-optimized modal component
 * Full-screen on mobile, centered dialog on desktop
 */
export default function MobileModal({
  isOpen,
  onClose,
  title,
  children,
  className = "",
  showCloseButton = true,
}: MobileModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`
          bg-white rounded-t-3xl md:rounded-xl shadow-2xl 
          w-full md:max-w-2xl md:max-h-[90vh]
          max-h-[95vh] overflow-y-auto
          animate-slide-up md:animate-none
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center z-10">
            {title && (
              <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-auto text-gray-400 hover:text-gray-600 text-3xl md:text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

