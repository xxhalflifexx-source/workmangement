"use client";

import { useState, useEffect } from "react";

interface PhotoViewerModalProps {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

export default function PhotoViewerModal({
  photos,
  initialIndex = 0,
  onClose,
}: PhotoViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photos.length, onClose]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  if (photos.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-2 sm:p-4 z-50"
      onClick={onClose}
    >
      <div
        className="relative max-w-7xl w-full max-h-[95vh] sm:max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white hover:text-gray-300 active:text-gray-400 text-2xl sm:text-3xl font-bold z-10 bg-black bg-opacity-70 rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center touch-manipulation shadow-lg"
          aria-label="Close photo viewer"
        >
          ×
        </button>

        {/* Previous button */}
        {photos.length > 1 && (
          <button
            onClick={handlePrevious}
            className="absolute left-2 sm:left-4 text-white hover:text-gray-300 active:text-gray-400 text-3xl sm:text-4xl font-bold z-10 bg-black bg-opacity-70 rounded-full w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center touch-manipulation shadow-lg"
            aria-label="Previous photo"
          >
            ‹
          </button>
        )}

        {/* Image */}
        <div className="max-w-full max-h-[95vh] sm:max-h-[90vh] flex items-center justify-center px-2 sm:px-4">
          <img
            src={photos[currentIndex]}
            alt={`Photo ${currentIndex + 1} of ${photos.length}`}
            className="max-w-full max-h-[95vh] sm:max-h-[90vh] object-contain rounded-lg"
          />
        </div>

        {/* Next button */}
        {photos.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-2 sm:right-4 text-white hover:text-gray-300 active:text-gray-400 text-3xl sm:text-4xl font-bold z-10 bg-black bg-opacity-70 rounded-full w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center touch-manipulation shadow-lg"
            aria-label="Next photo"
          >
            ›
          </button>
        )}

        {/* Photo counter */}
        {photos.length > 1 && (
          <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium">
            {currentIndex + 1} / {photos.length}
          </div>
        )}

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <div className="absolute bottom-12 sm:bottom-16 left-1/2 transform -translate-x-1/2 flex gap-1.5 sm:gap-2 max-w-[calc(100%-2rem)] sm:max-w-full overflow-x-auto px-2 sm:px-4 pb-2">
            {photos.map((photo, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded border-2 overflow-hidden touch-manipulation transition-all ${
                  idx === currentIndex
                    ? "border-white shadow-lg scale-105"
                    : "border-gray-600 opacity-60 hover:opacity-100 active:opacity-80"
                }`}
                aria-label={`View photo ${idx + 1}`}
              >
                <img
                  src={photo}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

