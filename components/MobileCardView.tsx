"use client";

import React from "react";

interface MobileCardViewProps {
  items: any[];
  renderCard: (item: any, index: number) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

/**
 * Mobile-optimized card view component
 * Displays items as cards on mobile, hidden on desktop (use with table)
 */
export default function MobileCardView({
  items,
  renderCard,
  emptyMessage = "No items found",
  className = "",
}: MobileCardViewProps) {
  if (items.length === 0) {
    return (
      <div className={`md:hidden p-6 text-center text-gray-500 ${className}`}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`md:hidden space-y-4 ${className}`}>
      {items.map((item, index) => (
        <div key={item.id || index}>{renderCard(item, index)}</div>
      ))}
    </div>
  );
}

