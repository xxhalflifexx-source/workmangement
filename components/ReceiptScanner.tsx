"use client";

import { useState, useRef } from "react";
import { extractAmountFromText, extractAllAmounts, extractAmountsWithContext } from "@/lib/receipt-ocr";

interface ReceiptScannerProps {
  jobId: string;
  userId: string;
  onScanComplete: (amount: number, receiptUrl: string) => void;
  onCancel: () => void;
}

export default function ReceiptScanner({
  jobId,
  userId,
  onScanComplete,
  onCancel,
}: ReceiptScannerProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedAmount, setExtractedAmount] = useState<number | null>(null);
  const [verifiedAmount, setVerifiedAmount] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [allAmounts, setAllAmounts] = useState<number[]>([]);
  const [amountsWithContext, setAmountsWithContext] = useState<Array<{ amount: number; line: string; keyword: string }>>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [imageQualityWarning, setImageQualityWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile device
  const isMobile = typeof window !== "undefined" && (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    window.innerWidth < 768
  );

  // Image preprocessing function
  const preprocessImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      img.onload = () => {
        try {
          // Set optimal canvas size (max 2000px for OCR)
          const maxWidth = 2000;
          const maxHeight = 2000;
          let { width, height } = img;

          // Scale down if too large
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          // Ensure minimum size for OCR (at least 300px)
          const minSize = 300;
          if (width < minSize && height < minSize) {
            const scale = minSize / Math.min(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          canvas.width = width;
          canvas.height = height;

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Get image data for processing
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;

          // Apply preprocessing: contrast, brightness, and convert to grayscale
          // More aggressive for mobile
          const contrastFactor = isMobile ? 1.3 : 1.2;
          const brightnessOffset = isMobile ? 10 : 5;

          for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale
            const gray = Math.round(
              0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
            );

            // Apply contrast and brightness
            let adjusted = gray * contrastFactor + brightnessOffset;
            adjusted = Math.max(0, Math.min(255, adjusted));

            // Set RGB to grayscale value
            data[i] = adjusted;     // R
            data[i + 1] = adjusted; // G
            data[i + 2] = adjusted; // B
            // Alpha channel (data[i + 3]) stays the same
          }

          // Put processed image data back
          ctx.putImageData(imageData, 0, 0);

          // Convert canvas to blob, then to File
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to process image"));
                return;
              }
              const processedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(processedFile);
            },
            "image/jpeg",
            0.95
          );
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      // Load image
      const reader = new FileReader();
      reader.onloadend = () => {
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        reject(new Error("Failed to read image file"));
      };
      reader.readAsDataURL(file);
    });
  };

  // Check image quality
  const checkImageQuality = async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const warnings: string[] = [];

        // Check resolution
        if (img.width < 300 || img.height < 300) {
          warnings.push("Image resolution is low. Try taking a closer photo.");
        }

        // Check aspect ratio (very wide or tall images might be problematic)
        const aspectRatio = img.width / img.height;
        if (aspectRatio > 3 || aspectRatio < 0.3) {
          warnings.push("Image appears stretched. Ensure receipt is fully visible.");
        }

        resolve(warnings.length > 0 ? warnings.join(" ") : null);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image file is too large (max 10MB)");
      return;
    }

    setError(null);
    setExtractedAmount(null);
    setVerifiedAmount("");
    setImageQualityWarning(null);

    // Check image quality
    const qualityWarning = await checkImageQuality(file);
    if (qualityWarning) {
      setImageQualityWarning(qualityWarning);
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const processReceipt = async () => {
    if (!imageFile) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setOcrText("");
    setAllAmounts([]);
    setImageQualityWarning(null);

    try {
      // Dynamically import Tesseract to avoid SSR issues
      const Tesseract = (await import("tesseract.js")).default;

      console.log("[ReceiptScanner] Starting OCR processing...");
      console.log("[ReceiptScanner] Mobile device:", isMobile);

      // Preprocess image before OCR
      setProgress(5);
      let processedFile: File;
      try {
        console.log("[ReceiptScanner] Preprocessing image...");
        processedFile = await preprocessImage(imageFile);
        console.log("[ReceiptScanner] Image preprocessing complete");
        setProgress(10);
      } catch (preprocessError: any) {
        console.warn("[ReceiptScanner] Preprocessing failed, using original:", preprocessError);
        // Fallback to original file if preprocessing fails
        processedFile = imageFile;
      }

      // Process image with Tesseract OCR
      const { data } = await Tesseract.recognize(processedFile, "eng", {
        logger: (m) => {
          console.log("[ReceiptScanner] OCR progress:", m);
          if (m.status === "recognizing text") {
            // Map progress from 10-100% (since preprocessing took first 10%)
            setProgress(Math.min(100, 10 + Math.round(m.progress * 90)));
          }
        },
      });

      console.log("[ReceiptScanner] OCR text extracted:", data.text);
      setOcrText(data.text || "");

      // Extract all amounts found
      const allFoundAmounts = extractAllAmounts(data.text);
      setAllAmounts(allFoundAmounts);
      console.log("[ReceiptScanner] All amounts found:", allFoundAmounts);

      // Extract amounts with context
      const amountsWithCtx = extractAmountsWithContext(data.text);
      setAmountsWithContext(amountsWithCtx);
      console.log("[ReceiptScanner] Amounts with context:", amountsWithCtx);

      // Extract primary amount from OCR text
      const amount = extractAmountFromText(data.text);
      console.log("[ReceiptScanner] Primary amount extracted:", amount);

      if (amount) {
        setExtractedAmount(amount);
        setVerifiedAmount(amount.toFixed(2));
        setError(null);
      } else {
        // Show helpful error with detected amounts
        if (allFoundAmounts.length > 0) {
          const errorMsg = isMobile
            ? `Could not detect total amount. Found these amounts: ${allFoundAmounts.map(a => `$${a.toFixed(2)}`).join(", ")}. Please select one or enter manually. Tip: Try zooming in on the total line for better results.`
            : `Could not detect total amount. Found these amounts: ${allFoundAmounts.map(a => `$${a.toFixed(2)}`).join(", ")}. Please select one or enter manually.`;
          setError(errorMsg);
          // Pre-fill with the largest amount found
          const largestAmount = allFoundAmounts[0];
          setVerifiedAmount(largestAmount.toFixed(2));
        } else {
          const errorMsg = isMobile
            ? "Could not detect any amounts in receipt. The image might be unclear, blurry, or the receipt format is not recognized. Try: 1) Ensure good lighting, 2) Hold phone steady, 3) Zoom in on the total line, 4) Or enter the amount manually."
            : data.text && data.text.trim().length > 0
            ? "Could not detect any amounts in receipt. Text was found but no amounts were recognized. Please enter the amount manually."
            : "Could not detect any text in receipt. The image might be unclear or the receipt format is not recognized. Please enter the amount manually.";
          setError(errorMsg);
        }
        setExtractedAmount(null);
      }
    } catch (err: any) {
      console.error("[ReceiptScanner] OCR processing error:", err);
      const errorMsg = isMobile
        ? `Failed to process receipt: ${err?.message || "Unknown error"}. On mobile, try: 1) Ensure good lighting, 2) Hold phone steady, 3) Zoom in on the total line. Or enter amount manually.`
        : `Failed to process receipt: ${err?.message || "Unknown error"}. Please try again or enter amount manually.`;
      setError(errorMsg);
      setExtractedAmount(null);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const uploadReceipt = async () => {
    if (!imageFile) return;

    const finalAmount = parseFloat(verifiedAmount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Step 1: Get signed upload URL
      const urlRes = await fetch("/api/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            {
              name: imageFile.name,
              type: imageFile.type,
            },
          ],
          folder: "receipts",
        }),
      });

      if (!urlRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const urlData = await urlRes.json();
      const uploadUrl = urlData.uploadUrls?.[0];

      if (!uploadUrl) {
        throw new Error("No upload URL received");
      }

      // Step 2: Upload directly to Supabase
      const uploadResponse = await fetch(uploadUrl.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": imageFile.type || "image/jpeg",
        },
        body: imageFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload receipt");
      }

      // Step 3: Confirm upload and get public URL
      const confirmRes = await fetch("/api/confirm-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: uploadUrl.path,
          originalName: imageFile.name,
          fileSize: imageFile.size,
        }),
      });

      if (!confirmRes.ok) {
        throw new Error("Failed to confirm upload");
      }

      const confirmData = await confirmRes.json();

      // Callback with extracted amount and receipt URL
      onScanComplete(finalAmount, confirmData.fileUrl);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "Failed to upload receipt. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUseAmount = () => {
    if (extractedAmount) {
      setVerifiedAmount(extractedAmount.toFixed(2));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">📷 Scan Receipt</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isProcessing || isUploading}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Input */}
          {!imageFile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select or Capture Receipt Image
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium min-h-[44px]"
                >
                  📸 Choose Image
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                On mobile devices, this will open your camera. On desktop, select an image file.
              </p>
              {isMobile && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-medium text-blue-900 mb-1">📱 Mobile Tips:</p>
                  <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                    <li>Ensure good lighting</li>
                    <li>Hold phone steady</li>
                    <li>Zoom in on the total line for best results</li>
                    <li>Make sure receipt is fully visible</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Image Preview */}
          {imagePreview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Receipt Preview
              </label>
              {imageQualityWarning && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <p className="text-xs font-medium text-yellow-900">⚠️ Image Quality Warning:</p>
                  <p className="text-xs text-yellow-800 mt-1">{imageQualityWarning}</p>
                </div>
              )}
              <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                <img
                  src={imagePreview}
                  alt="Receipt preview"
                  className="max-w-full max-h-64 mx-auto rounded-lg"
                />
              </div>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setExtractedAmount(null);
                    setVerifiedAmount("");
                    setError(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Change Image
                </button>
                {!isProcessing && !extractedAmount && (
                  <button
                    onClick={processReceipt}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    🔍 Scan Receipt
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Scanning receipt...</p>
              <p className="text-sm text-gray-500 mt-2">{progress}% complete</p>
            </div>
          )}

          {/* Extracted Amount */}
          {extractedAmount && !isProcessing && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                ✓ Amount Detected
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Detected Amount
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white border-2 border-green-300 rounded-lg px-4 py-3">
                      <span className="text-2xl font-bold text-green-700">
                        ${extractedAmount.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={handleUseAmount}
                      className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      Use This
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verify Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={verifiedAmount}
                      onChange={(e) => setVerifiedAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full border-2 border-gray-300 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors bg-white min-h-[44px]"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Please verify the amount is correct before continuing
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Manual Entry Fallback */}
          {!extractedAmount && !isProcessing && imageFile && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Manual Entry Required
              </h3>
              
              {/* Show detected amounts with context if available */}
              {amountsWithContext.length > 0 ? (
                <div className="mb-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">Detected amounts (with context):</p>
                  {amountsWithContext.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-lg border border-yellow-300 hover:border-yellow-400 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold text-gray-900">${item.amount.toFixed(2)}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                              {item.keyword}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 font-mono truncate" title={item.line}>
                            {item.line.length > 60 ? item.line.substring(0, 60) + "..." : item.line}
                          </p>
                        </div>
                        <button
                          onClick={() => setVerifiedAmount(item.amount.toFixed(2))}
                          className="ml-3 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Use
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : allAmounts.length > 0 ? (
                <div className="mb-4 p-3 bg-white rounded-lg border border-yellow-300">
                  <p className="text-sm font-medium text-gray-700 mb-2">Detected amounts:</p>
                  <div className="flex flex-wrap gap-2">
                    {allAmounts.map((amt, idx) => (
                      <button
                        key={idx}
                        onClick={() => setVerifiedAmount(amt.toFixed(2))}
                        className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 border border-yellow-400 rounded text-sm font-medium text-gray-900"
                      >
                        ${amt.toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={verifiedAmount}
                    onChange={(e) => setVerifiedAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full border-2 border-gray-300 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors bg-white min-h-[44px]"
                  />
                </div>
              </div>

              {/* Debug toggle */}
              {ocrText && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="text-xs text-gray-600 hover:text-gray-800 underline"
                  >
                    {showDebug ? "Hide" : "Show"} OCR text (for debugging)
                  </button>
                  {showDebug && (
                    <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700 max-h-32 overflow-y-auto">
                      {ocrText || "No text extracted"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          {imageFile && !isProcessing && (
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={uploadReceipt}
                disabled={
                  isUploading ||
                  !verifiedAmount ||
                  parseFloat(verifiedAmount) <= 0
                }
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isUploading ? "Uploading..." : "✓ Use This Amount"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

