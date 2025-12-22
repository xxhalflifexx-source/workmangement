"use client";

import React from "react";

interface SOPViewerProps {
  title: string;
  content: string;
  createdBy?: { name?: string | null; email?: string | null };
  createdAt?: Date | string;
  updatedAt?: Date | string;
  onEdit?: () => void;
  onClose: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function SOPViewer({
  title,
  content,
  createdBy,
  createdAt,
  updatedAt,
  onEdit,
  onClose,
  onDelete,
  canEdit = false,
  canDelete = false,
}: SOPViewerProps) {
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
            h1 { margin-bottom: 20px; }
            img { max-width: 100%; height: auto; }
            .meta { color: #666; font-size: 12px; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">
            ${createdBy ? `Created by: ${createdBy.name || createdBy.email}` : ""}
            ${updatedAt ? ` | Last updated: ${formatDate(updatedAt)}` : ""}
          </div>
          ${content}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              {createdBy && (
                <span>By {createdBy.name || createdBy.email}</span>
              )}
              {updatedAt && (
                <>
                  <span>•</span>
                  <span>Updated {formatDate(updatedAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            title="Print"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          {canEdit && onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
          {canDelete && onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
          <div 
            className="prose dark:prose-invert max-w-none sop-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      </div>

      {/* Custom styles for content */}
      <style jsx global>{`
        .sop-content {
          color: #111827 !important;
        }
        .dark .sop-content {
          color: #f9fafb !important;
        }
        .sop-content * {
          color: inherit;
        }
        .sop-content p,
        .sop-content div,
        .sop-content span,
        .sop-content li,
        .sop-content td,
        .sop-content th {
          color: #111827 !important;
        }
        .dark .sop-content p,
        .dark .sop-content div,
        .dark .sop-content span,
        .dark .sop-content li,
        .dark .sop-content td,
        .dark .sop-content th {
          color: #f9fafb !important;
        }
        .sop-content h1,
        .sop-content h2,
        .sop-content h3,
        .sop-content h4,
        .sop-content h5,
        .sop-content h6 {
          color: #111827 !important;
          margin-top: 24px;
          margin-bottom: 16px;
        }
        .dark .sop-content h1,
        .dark .sop-content h2,
        .dark .sop-content h3,
        .dark .sop-content h4,
        .dark .sop-content h5,
        .dark .sop-content h6 {
          color: #f9fafb !important;
        }
        .sop-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 16px 0;
        }
        .sop-content p {
          margin-bottom: 16px;
          line-height: 1.7;
        }
        .sop-content ul, .sop-content ol {
          margin-bottom: 16px;
          padding-left: 24px;
        }
        .sop-content li {
          margin-bottom: 8px;
        }
        .sop-content blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 16px;
          margin: 16px 0;
          color: #6b7280 !important;
        }
        .dark .sop-content blockquote {
          color: #9ca3af !important;
        }
        .sop-content pre {
          background: #f3f4f6 !important;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          color: #111827 !important;
        }
        .dark .sop-content pre {
          background: #1f2937 !important;
          color: #f9fafb !important;
        }
        .sop-content code {
          background: #f3f4f6 !important;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 14px;
          color: #111827 !important;
        }
        .dark .sop-content code {
          background: #374151 !important;
          color: #f9fafb !important;
        }
        .sop-content a {
          color: #3b82f6 !important;
          text-decoration: underline;
        }
        .dark .sop-content a {
          color: #60a5fa !important;
        }
        .sop-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
        }
        .sop-content th, .sop-content td {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          text-align: left;
        }
        .dark .sop-content th, .dark .sop-content td {
          border-color: #374151;
        }
        .sop-content th {
          background: #f9fafb !important;
          font-weight: 600;
          color: #111827 !important;
        }
        .dark .sop-content th {
          background: #1f2937 !important;
          color: #f9fafb !important;
        }
        /* Override any inline background colors that might cause visibility issues */
        .sop-content [style*="background"] {
          background: transparent !important;
        }
        .sop-content [style*="background-color"] {
          background-color: transparent !important;
        }
        /* Ensure text in elements with background colors is visible */
        .sop-content [style*="background"] * {
          color: #111827 !important;
        }
        .dark .sop-content [style*="background"] * {
          color: #f9fafb !important;
        }
      `}</style>
    </div>
  );
}

