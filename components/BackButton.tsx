"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface BackButtonProps {
  href?: string;
  label?: string;
  useBrowserBack?: boolean;
  className?: string;
}

export default function BackButton({ 
  href, 
  label = "Back", 
  useBrowserBack = false,
  className = "w-full sm:w-auto min-h-[44px] flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
}: BackButtonProps) {
  const router = useRouter();

  if (useBrowserBack) {
    return (
      <button
        onClick={() => router.back()}
        className={className}
      >
        ← {label}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className}>
        ← {label}
      </Link>
    );
  }

  // Default to dashboard if no href provided
  return (
    <Link href="/dashboard" className={className}>
      ← Back to Dashboard
    </Link>
  );
}

