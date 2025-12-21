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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setImageFile(file);
    setError(null);
    setExtractedAmount(null);
    setVerifiedAmount("");

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

    try {
      // Dynamically import Tesseract to avoid SSR issues
      const Tesseract = (await import("tesseract.js")).default;

      console.log("[ReceiptScanner] Starting OCR processing...");

      // Process image with Tesseract OCR
      const { data } = await Tesseract.recognize(imageFile, "eng", {
        logger: (m) => {
          console.log("[ReceiptScanner] OCR progress:", m);
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
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
          setError(
            `Could not detect total amount. Found these amounts: ${allFoundAmounts.map(a => `$${a.toFixed(2)}`).join(", ")}. Please select one or enter manually.`
          );
          // Pre-fill with the largest amount found
          const largestAmount = allFoundAmounts[0];
          setVerifiedAmount(largestAmount.toFixed(2));
        } else {
          setError("Could not detect any amounts in receipt. The image might be unclear or the receipt format is not recognized. Please enter the amount manually.");
        }
        setExtractedAmount(null);
      }
    } catch (err: any) {
      console.error("[ReceiptScanner] OCR processing error:", err);
      setError(`Failed to process receipt: ${err?.message || "Unknown error"}. Please try again or enter amount manually.`);
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
            </div>
          )}

          {/* Image Preview */}
          {imagePreview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Receipt Preview
              </label>
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

