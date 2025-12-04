"use client";

interface LoginLoadingOverlayProps {
  show: boolean;
}

export default function LoginLoadingOverlay({ show }: LoginLoadingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="text-center">
        {/* TCB Metal Works Text with fade-in/out animation */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white/30 mb-4 animate-fade-in-out">
          TCB Metal Works
        </h1>
        
        {/* Loading Spinner */}
        <div className="flex justify-center">
          <div className="w-8 h-8 border-4 border-white/20 border-t-white/60 rounded-full animate-spin"></div>
        </div>
        
        {/* Optional Loading Text */}
        <p className="text-white/40 text-sm mt-4 animate-pulse">Loading...</p>
      </div>
    </div>
  );
}

