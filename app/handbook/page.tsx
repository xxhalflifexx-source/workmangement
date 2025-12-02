"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getHandbookContent, saveHandbookContent } from "./actions";
import RichTextEditor from "@/components/RichTextEditor";

export default function HandbookPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === "ADMIN";
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setLoading(true);
    setError(undefined);
    const res = await getHandbookContent();
    if (res.ok) {
      setContent(res.content || "");
    } else {
      setError(res.error);
      setContent("");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(undefined);
    setSuccess(undefined);

    const res = await saveHandbookContent(content);
    if (res.ok) {
      setSuccess("Handbook updated successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccess(undefined), 3000);
    } else {
      setError(res.error || "Failed to save handbook");
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    loadContent(); // Reload original content
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading handbook...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">📖 Employee Handbook</h1>
            <p className="text-xs sm:text-sm text-gray-500">Company policies and procedures</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {isAdmin && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px] flex items-center justify-center"
              >
                ✏️ Edit Handbook
              </button>
            )}
            {isAdmin && isEditing && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px] flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "💾 Save Changes"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </>
            )}
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px] flex items-center justify-center"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {success}
            <button
              onClick={() => setSuccess(undefined)}
              className="float-right text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
            <button
              onClick={() => setError(undefined)}
              className="float-right text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Welcome Section - Only show when not editing */}
        {!isEditing && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 sm:p-8 mb-6 sm:mb-8 text-white">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Welcome to Our Team! 👋</h2>
            <p className="text-blue-100 text-sm sm:text-base lg:text-lg">
              This handbook is designed to help you understand our company culture, policies, and procedures. 
              Please read through it carefully and refer back as needed.
            </p>
          </div>
        )}

        {/* Content Editor or Viewer */}
        {isEditing ? (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Handbook Content</h3>
            <p className="text-sm text-gray-600 mb-4">
              Use the toolbar above to format your content. You can add headings, lists, links, images, and more.
            </p>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Start editing the employee handbook content..."
            />
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 Tip:</strong> Use headings (H1, H2, H3) to organize sections. Use lists for bullet points and numbered items. 
                You can add links, images, and format text using the toolbar.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-6 sm:p-8">
            <div 
              className="handbook-content"
              dangerouslySetInnerHTML={{ __html: content }}
            />
            <style jsx global>{`
              .handbook-content {
                font-size: 16px;
                line-height: 1.75;
                color: #374151;
              }
              .handbook-content p {
                margin-bottom: 1rem;
                line-height: 1.75;
              }
              .handbook-content h1,
              .handbook-content h2,
              .handbook-content h3,
              .handbook-content h4,
              .handbook-content h5,
              .handbook-content h6 {
                font-weight: bold;
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
                color: #111827;
                line-height: 1.3;
              }
              .handbook-content h1 {
                font-size: 2.25rem;
              }
              .handbook-content h2 {
                font-size: 1.875rem;
              }
              .handbook-content h3 {
                font-size: 1.5rem;
              }
              .handbook-content h4 {
                font-size: 1.25rem;
              }
              .handbook-content h5 {
                font-size: 1.125rem;
              }
              .handbook-content h6 {
                font-size: 1rem;
              }
              .handbook-content ul,
              .handbook-content ol {
                margin-left: 1.5rem;
                margin-bottom: 1rem;
                padding-left: 1.5rem;
              }
              .handbook-content ul {
                list-style-type: disc;
              }
              .handbook-content ol {
                list-style-type: decimal;
              }
              .handbook-content li {
                margin-bottom: 0.5rem;
                line-height: 1.75;
              }
              .handbook-content ul ul,
              .handbook-content ol ol,
              .handbook-content ul ol,
              .handbook-content ol ul {
                margin-top: 0.5rem;
                margin-bottom: 0.5rem;
              }
              .handbook-content strong,
              .handbook-content b {
                font-weight: 700;
                color: #111827;
              }
              .handbook-content em,
              .handbook-content i {
                font-style: italic;
              }
              .handbook-content u {
                text-decoration: underline;
              }
              .handbook-content s,
              .handbook-content strike {
                text-decoration: line-through;
              }
              .handbook-content a {
                color: #2563eb;
                text-decoration: none;
              }
              .handbook-content a:hover {
                text-decoration: underline;
              }
              .handbook-content blockquote {
                border-left: 4px solid #3b82f6;
                padding-left: 1rem;
                padding-top: 0.5rem;
                padding-bottom: 0.5rem;
                margin: 1rem 0;
                background-color: #eff6ff;
                border-radius: 0.25rem;
                color: #1e40af;
              }
              .handbook-content blockquote p {
                margin-bottom: 0.5rem;
              }
              .handbook-content blockquote p:last-child {
                margin-bottom: 0;
              }
              .handbook-content img {
                max-width: 100%;
                height: auto;
                border-radius: 0.5rem;
                margin: 1rem 0;
              }
              .handbook-content code {
                background-color: #f3f4f6;
                padding: 0.125rem 0.375rem;
                border-radius: 0.25rem;
                font-family: monospace;
                font-size: 0.875em;
              }
              .handbook-content pre {
                background-color: #1f2937;
                color: #f9fafb;
                padding: 1rem;
                border-radius: 0.5rem;
                overflow-x: auto;
                margin: 1rem 0;
              }
              .handbook-content pre code {
                background-color: transparent;
                padding: 0;
                color: inherit;
              }
              /* Quill-specific classes */
              .handbook-content .ql-align-center {
                text-align: center;
              }
              .handbook-content .ql-align-right {
                text-align: right;
              }
              .handbook-content .ql-align-justify {
                text-align: justify;
              }
              .handbook-content .ql-indent-1 {
                padding-left: 3em;
              }
              .handbook-content .ql-indent-2 {
                padding-left: 6em;
              }
              .handbook-content .ql-indent-3 {
                padding-left: 9em;
              }
              .handbook-content .ql-size-small {
                font-size: 0.75em;
              }
              .handbook-content .ql-size-large {
                font-size: 1.5em;
              }
              .handbook-content .ql-size-huge {
                font-size: 2.5em;
              }
              /* Ensure proper spacing between elements */
              .handbook-content > *:first-child {
                margin-top: 0;
              }
              .handbook-content > *:last-child {
                margin-bottom: 0;
              }
              /* Handle empty paragraphs */
              .handbook-content p:empty {
                height: 1rem;
                margin: 0.5rem 0;
              }
              /* Ensure lists have proper spacing */
              .handbook-content ul + p,
              .handbook-content ol + p,
              .handbook-content p + ul,
              .handbook-content p + ol {
                margin-top: 1rem;
              }
            `}</style>
          </div>
        )}

        {/* Acknowledgment Section */}
        {!isEditing && (
          <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow p-4 sm:p-6 border-2 border-green-200">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">📝 Handbook Acknowledgment</h3>
            <p className="text-gray-700 mb-4 text-sm sm:text-base">
              By accessing this handbook, you acknowledge that you have read, understood, and agree to comply with 
              all policies and procedures outlined above. This handbook is subject to change, and you will be notified 
              of any updates.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
