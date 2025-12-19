"use client";

import { useState } from "react";

export default function FlowchartDownloadButton() {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch("/api/system-flowchart");
      if (!response.ok) {
        throw new Error("Failed to download flowchart");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `system-flowchart-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading flowchart:", error);
      alert("Failed to download flowchart. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="w-full h-full min-h-[120px] sm:min-h-[140px] flex flex-col items-center justify-center gap-2 p-4 bg-white border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
    >
      <span className="text-3xl sm:text-4xl">{isDownloading ? "⏳" : "📊"}</span>
      <div className="text-center">
        <div className="text-sm sm:text-base font-semibold text-gray-900">
          {isDownloading ? "Generating..." : "System Flowchart"}
        </div>
        <div className="text-xs sm:text-sm text-gray-600 mt-1">
          {isDownloading ? "Please wait" : "Download PDF guide"}
        </div>
      </div>
    </button>
  );
}

