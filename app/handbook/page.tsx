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
              className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-ul:list-disc prose-ol:list-decimal prose-li:my-2 prose-strong:text-gray-900 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded"
              dangerouslySetInnerHTML={{ __html: content }}
            />
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
