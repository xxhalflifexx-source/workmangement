"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill"), { 
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <div className="animate-pulse text-gray-500">Loading editor...</div>
    </div>
  ),
});

import "react-quill/dist/quill.snow.css";

interface SOPEditorProps {
  initialContent?: string;
  onSave: (title: string, content: string) => Promise<void>;
  onCancel: () => void;
  initialTitle?: string;
  templates?: Array<{ id: string; name: string; content: string; description?: string | null }>;
  onSaveAsTemplate?: (name: string, content: string, description?: string) => Promise<void>;
  isNew?: boolean;
}

export default function SOPEditor({
  initialContent = "",
  onSave,
  onCancel,
  initialTitle = "",
  templates = [],
  onSaveAsTemplate,
  isNew = false,
}: SOPEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [error, setError] = useState<string | undefined>();

  // Quill modules configuration
  const modules = useMemo(() => ({
    toolbar: [
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ font: [] }],
      [{ size: ["small", false, "large", "huge"] }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ script: "sub" }, { script: "super" }],
      [{ list: "ordered" }, { list: "bullet" }, { list: "check" }],
      [{ indent: "-1" }, { indent: "+1" }],
      [{ align: [] }],
      ["blockquote", "code-block"],
      ["link", "image"],
      ["clean"],
    ],
    clipboard: {
      matchVisual: false,
    },
  }), []);

  const formats = [
    "header", "font", "size",
    "bold", "italic", "underline", "strike",
    "color", "background",
    "script",
    "list", "bullet", "check",
    "indent", "align",
    "blockquote", "code-block",
    "link", "image",
  ];

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Please enter a title");
      return;
    }
    if (!content.trim() || content === "<p><br></p>") {
      setError("Please enter some content");
      return;
    }

    setSaving(true);
    setError(undefined);
    try {
      await onSave(title.trim(), content);
    } catch (err: any) {
      setError(err?.message || "Failed to save document");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadTemplate = (template: { id: string; name: string; content: string }) => {
    setContent(template.content);
    setShowTemplateModal(false);
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      setError("Please enter a template name");
      return;
    }
    if (!content.trim() || content === "<p><br></p>") {
      setError("Please enter some content first");
      return;
    }

    setSaving(true);
    setError(undefined);
    try {
      if (onSaveAsTemplate) {
        await onSaveAsTemplate(templateName.trim(), content, templateDescription.trim() || undefined);
        setShowSaveTemplateModal(false);
        setTemplateName("");
        setTemplateDescription("");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 pt-24">
      {/* Header with Title Input */}
      <div className="px-4 sm:px-6 py-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition flex-shrink-0"
            title="Back to folder"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your document..."
              className="w-full text-base sm:text-lg font-semibold bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              autoFocus
            />
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            placeholder="Start writing your SOP document..."
            className="h-[calc(100vh-380px)] bg-white dark:bg-gray-800 rounded-lg"
          />
        </div>
      </div>

      {/* Fixed Footer with Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t dark:border-gray-700 px-4 sm:px-6 py-4 shadow-lg z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            {templates.length > 0 && (
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition hidden sm:flex items-center gap-2"
              >
                📋 Load Template
              </button>
            )}
            {onSaveAsTemplate && (
              <button
                onClick={() => setShowSaveTemplateModal(true)}
                className="px-4 py-2.5 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 rounded-lg transition hidden sm:flex items-center gap-2"
              >
                📝 Save as Template
              </button>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 text-base font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2 shadow-md"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                💾 {isNew ? "Save Document" : "Save Changes"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Load Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Load Template</h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-96">
              {templates.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No templates available</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleLoadTemplate(template)}
                      className="w-full p-4 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition"
                    >
                      <div className="font-medium">{template.name}</div>
                      {template.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {template.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Save as Template</h3>
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Safety SOP Template"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Brief description of when to use this template..."
                  rows={3}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsTemplate}
                  disabled={saving || !templateName.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom styles for Quill */}
      <style jsx global>{`
        .ql-container {
          font-size: 16px;
          font-family: inherit;
        }
        .ql-editor {
          min-height: 400px;
          padding: 20px;
        }
        .ql-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 16px 0;
        }
        .ql-toolbar {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          background: #f8fafc;
          border-color: #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .dark .ql-toolbar {
          background: #1f2937;
          border-color: #374151;
        }
        .dark .ql-toolbar button {
          color: #9ca3af;
        }
        .dark .ql-toolbar button:hover,
        .dark .ql-toolbar button.ql-active {
          color: #fff;
        }
        .dark .ql-toolbar .ql-stroke {
          stroke: #9ca3af;
        }
        .dark .ql-toolbar .ql-fill {
          fill: #9ca3af;
        }
        .dark .ql-toolbar button:hover .ql-stroke,
        .dark .ql-toolbar button.ql-active .ql-stroke {
          stroke: #fff;
        }
        .dark .ql-toolbar button:hover .ql-fill,
        .dark .ql-toolbar button.ql-active .ql-fill {
          fill: #fff;
        }
        .dark .ql-toolbar .ql-picker {
          color: #9ca3af;
        }
        .dark .ql-toolbar .ql-picker-options {
          background: #1f2937;
          border-color: #374151;
        }
        .ql-container {
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
          border-color: #e2e8f0;
        }
        .dark .ql-container {
          border-color: #374151;
        }
        .dark .ql-editor {
          color: #f3f4f6;
        }
        .dark .ql-editor.ql-blank::before {
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}

