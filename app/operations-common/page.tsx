"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  getFolders,
  getFiles,
  createFolder,
  updateFolder,
  deleteFolder,
  createFile,
  updateFile,
  deleteFile,
  getFile,
} from "./actions";
import { formatDateTime, formatDateShort } from "@/lib/date-utils";

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator: {
    name: string | null;
    email: string | null;
  };
  _count: {
    files: number;
    children: number;
  };
}

interface File {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  folderId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator: {
    name: string | null;
    email: string | null;
  };
  folder: {
    id: string;
    name: string;
  } | null;
}

type ViewMode = "folders" | "files" | "mixed";
type SortField = "name" | "dateModified" | "type" | "size";
type SortDirection = "asc" | "desc";

export default function OperationsCommonPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === "ADMIN";
  const canView = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "EMPLOYEE";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  // Navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([]);

  // Data
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("mixed");

  // Filters and search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // File details panel
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showFileDetails, setShowFileDetails] = useState(false);

  // Modals
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showEditFolderModal, setShowEditFolderModal] = useState(false);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteFileModal, setShowDeleteFileModal] = useState(false);
  const [showMoveFileModal, setShowMoveFileModal] = useState(false);
  const [showRenameFileModal, setShowRenameFileModal] = useState(false);

  // Form states
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<globalThis.File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<File | null>(null);
  const [movingFile, setMovingFile] = useState<File | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<File | null>(null);
  const [renamingFileName, setRenamingFileName] = useState("");
  const [downloadingFolder, setDownloadingFolder] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const [foldersRes, filesRes] = await Promise.all([
        getFolders(currentFolderId),
        getFiles(currentFolderId),
      ]);

      if (foldersRes.ok) {
        setFolders(foldersRes.folders || []);
      } else {
        setError(foldersRes.error);
      }

      if (filesRes.ok) {
        setFiles(filesRes.files || []);
      } else {
        setError(filesRes.error);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    if (canView) {
      loadData();
    }
  }, [canView, loadData]);

  // Filtered and sorted data
  const filteredAndSorted = useMemo(() => {
    let filteredFolders = [...folders];
    let filteredFiles = [...files];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredFolders = filteredFolders.filter((f) =>
        f.name.toLowerCase().includes(query)
      );
      filteredFiles = filteredFiles.filter(
        (f) =>
          f.name.toLowerCase().includes(query) ||
          f.originalName.toLowerCase().includes(query)
      );
    }

    // Type filter (for files)
    if (filterType !== "ALL") {
      filteredFiles = filteredFiles.filter((f) => f.fileType === filterType);
    }

    // Sort folders
    filteredFolders.sort((a, b) => {
      if (sortField === "name") {
        return sortDirection === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (sortField === "dateModified") {
        const aDate = new Date(a.updatedAt).getTime();
        const bDate = new Date(b.updatedAt).getTime();
        return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
      }
      return 0;
    });

    // Sort files
    filteredFiles.sort((a, b) => {
      if (sortField === "name") {
        return sortDirection === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (sortField === "dateModified") {
        const aDate = new Date(a.updatedAt).getTime();
        const bDate = new Date(b.updatedAt).getTime();
        return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
      } else if (sortField === "type") {
        return sortDirection === "asc"
          ? a.fileType.localeCompare(b.fileType)
          : b.fileType.localeCompare(a.fileType);
      } else if (sortField === "size") {
        return sortDirection === "asc"
          ? a.fileSize - b.fileSize
          : b.fileSize - a.fileSize;
      }
      return 0;
    });

    return { folders: filteredFolders, files: filteredFiles };
  }, [folders, files, searchQuery, filterType, sortField, sortDirection]);

  // Handle folder click
  const handleFolderClick = (folder: Folder) => {
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  // Handle breadcrumb click
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentFolderId(null);
      setFolderPath([]);
    } else {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      setCurrentFolderId(newPath[newPath.length - 1].id);
    }
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError("Folder name is required");
      return;
    }

    setError(undefined);
    const res = await createFolder(newFolderName.trim(), currentFolderId);
    if (res.ok) {
      setSuccess("Folder created successfully");
      setNewFolderName("");
      setShowCreateFolderModal(false);
      loadData();
    } else {
      setError(res.error);
    }
  };

  // Update folder
  const handleUpdateFolder = async () => {
    if (!editingFolder || !editingFolderName.trim()) {
      setError("Folder name is required");
      return;
    }

    setError(undefined);
    const res = await updateFolder(editingFolder.id, editingFolderName.trim());
    if (res.ok) {
      setSuccess("Folder updated successfully");
      setShowEditFolderModal(false);
      setEditingFolder(null);
      setEditingFolderName("");
      loadData();
    } else {
      setError(res.error);
    }
  };

  // Delete folder
  const handleDeleteFolder = async () => {
    if (!deletingFolder) return;

    setError(undefined);
    const res = await deleteFolder(deletingFolder.id);
    if (res.ok) {
      setSuccess("Folder deleted successfully");
      setShowDeleteFolderModal(false);
      setDeletingFolder(null);
      loadData();
    } else {
      setError(res.error);
    }
  };

  // Helper function to generate unique file name
  const generateUniqueFileName = (fileName: string, existingNames: Set<string>): string => {
    if (!existingNames.has(fileName)) {
      return fileName;
    }

    // Extract name and extension
    const lastDotIndex = fileName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

    // Try adding numbers until we find a unique name
    let counter = 1;
    let newFileName = `${nameWithoutExt} (${counter})${extension}`;
    while (existingNames.has(newFileName)) {
      counter++;
      newFileName = `${nameWithoutExt} (${counter})${extension}`;
    }

    return newFileName;
  };

  // Upload files - uses direct upload to Supabase to support large files
  const handleFileUpload = async () => {
    if (uploadingFiles.length === 0) {
      setError("Please select at least one file");
      return;
    }

    setUploading(true);
    setError(undefined);

    try {
      // Check for duplicate file names in current folder
      const existingFilesRes = await getFiles(currentFolderId);
      const existingFiles = existingFilesRes.ok ? existingFilesRes.files || [] : [];
      const existingFileNames = new Set(existingFiles.map((f: File) => f.name));

      // Check for duplicates in the files being uploaded
      const duplicateFiles: string[] = [];
      const filesToUpload: Array<{ file: globalThis.File; finalName: string }> = [];

      uploadingFiles.forEach((file) => {
        const fileName = file.name;
        if (existingFileNames.has(fileName)) {
          // Generate unique name
          const uniqueName = generateUniqueFileName(fileName, existingFileNames);
          filesToUpload.push({ file, finalName: uniqueName });
          existingFileNames.add(uniqueName);
          duplicateFiles.push(`${fileName} → ${uniqueName}`);
        } else {
          filesToUpload.push({ file, finalName: fileName });
          existingFileNames.add(fileName);
        }
      });

      // Step 1: Get signed upload URLs from the server
      const urlRes = await fetch("/api/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: filesToUpload.map(({ file }) => ({
            name: file.name,
            type: file.type,
          })),
          folder: "operations-common",
        }),
      });

      if (!urlRes.ok) {
        const errorData = await urlRes.json().catch(() => ({}));
        setError(errorData.error || "Failed to get upload URLs");
        setUploading(false);
        return;
      }

      const urlData = await urlRes.json();
      const uploadUrls = urlData.uploadUrls || [];

      if (uploadUrls.length === 0) {
        setError("Failed to generate upload URLs");
        setUploading(false);
        return;
      }

      // Step 2: Upload files directly to Supabase using signed URLs
      const uploadedFiles: Array<{
        originalName: string;
        fileType: string;
        fileSize: number;
        fileUrl: string;
      }> = [];
      const failedFiles: Array<{ originalName: string; error: string }> = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, finalName } = filesToUpload[i];
        const urlInfo = uploadUrls[i];

        if (!urlInfo) {
          failedFiles.push({ originalName: file.name, error: "No upload URL generated" });
          continue;
        }

        try {
          // Upload directly to Supabase using the signed URL
          const uploadResponse = await fetch(urlInfo.signedUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text().catch(() => "Upload failed");
            console.error(`Direct upload failed for ${file.name}:`, errorText);
            failedFiles.push({ originalName: file.name, error: `Upload failed: ${uploadResponse.status}` });
            continue;
          }

          // Step 3: Confirm upload and get public URL
          const confirmRes = await fetch("/api/confirm-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: urlInfo.path,
              originalName: file.name,
              fileSize: file.size,
            }),
          });

          if (!confirmRes.ok) {
            const confirmError = await confirmRes.json().catch(() => ({}));
            failedFiles.push({ originalName: file.name, error: confirmError.error || "Failed to confirm upload" });
            continue;
          }

          const confirmData = await confirmRes.json();
          uploadedFiles.push({
            originalName: file.name,
            fileType: confirmData.fileType,
            fileSize: file.size,
            fileUrl: confirmData.fileUrl,
          });

          // Create file record in database
          const res = await createFile(
            finalName,
            file.name,
            confirmData.fileType,
            file.size,
            confirmData.fileUrl,
            currentFolderId
          );
          if (!res.ok) {
            console.error("Failed to create file record:", res.error);
          }
        } catch (uploadError: any) {
          console.error(`Error uploading ${file.name}:`, uploadError);
          failedFiles.push({ originalName: file.name, error: uploadError?.message || "Upload failed" });
        }
      }

      // Show success/error messages
      if (uploadedFiles.length > 0 && failedFiles.length === 0) {
        if (duplicateFiles.length === 0) {
          setSuccess(`${uploadedFiles.length} file(s) uploaded successfully`);
        } else {
          setSuccess(`${uploadedFiles.length} file(s) uploaded successfully. ${duplicateFiles.length} file(s) renamed to avoid duplicates: ${duplicateFiles.join(', ')}`);
        }
      } else if (uploadedFiles.length > 0 && failedFiles.length > 0) {
        const failedDetails = failedFiles.map((f) => `${f.originalName}: ${f.error}`).join('; ');
        setSuccess(`${uploadedFiles.length} file(s) uploaded successfully`);
        setError(`${failedFiles.length} file(s) failed: ${failedDetails}`);
      } else if (failedFiles.length > 0) {
        const failedDetails = failedFiles.map((f) => `${f.originalName}: ${f.error}`).join('; ');
        setError(`All files failed to upload: ${failedDetails}`);
      }

      setShowUploadModal(false);
      setUploadingFiles([]);
      loadData();
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  // Delete file
  const handleDeleteFile = async () => {
    if (!deletingFile) return;

    setError(undefined);
    const res = await deleteFile(deletingFile.id);
    if (res.ok) {
      setSuccess("File deleted successfully");
      setShowDeleteFileModal(false);
      setDeletingFile(null);
      if (selectedFile?.id === deletingFile.id) {
        setSelectedFile(null);
        setShowFileDetails(false);
      }
      loadData();
    } else {
      setError(res.error);
    }
  };

  // Move file
  const handleMoveFile = async () => {
    if (!movingFile) return;

    setError(undefined);
    const res = await updateFile(movingFile.id, undefined, targetFolderId);
    if (res.ok) {
      setSuccess("File moved successfully");
      setShowMoveFileModal(false);
      setMovingFile(null);
      setTargetFolderId(null);
      loadData();
    } else {
      setError(res.error);
    }
  };

  // Rename file
  const handleRenameFile = async () => {
    if (!renamingFile || !renamingFileName.trim()) {
      setError("File name is required");
      return;
    }

    setError(undefined);
    const res = await updateFile(renamingFile.id, renamingFileName.trim());
    if (res.ok) {
      setSuccess("File renamed successfully");
      setShowRenameFileModal(false);
      setRenamingFile(null);
      setRenamingFileName("");
      if (selectedFile?.id === renamingFile.id && res.file) {
        setSelectedFile(res.file);
      }
      loadData();
    } else {
      setError(res.error);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  // Get file icon
  const getFileIcon = (fileType: string): string => {
    switch (fileType) {
      case "pdf":
        return "📄";
      case "image":
        return "🖼️";
      case "word":
        return "📝";
      case "excel":
        return "📊";
      case "cad":
        return "📐";
      default:
        return "📎";
    }
  };

  // Get all folders for move modal
  const getAllFoldersForMove = async (): Promise<Folder[]> => {
    const res = await getFolders(undefined);
    if (res.ok) {
      return res.folders || [];
    }
    return [];
  };

  if (!canView) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8">
          <div className="bg-white rounded-xl shadow border border-gray-200 p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black border-b-2 border-[#001f3f] shadow-lg sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white">📁 Operations Common</h1>
            <p className="text-xs sm:text-sm text-gray-300">Common operational documents</p>
          </div>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-4 py-2 border border-gray-400 rounded-lg hover:bg-gray-800 transition-all duration-200 hover:shadow-sm active:scale-95 text-sm font-medium text-white"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8 relative z-0">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">Error: {error}</p>
            </div>
            <button
              onClick={() => setError(undefined)}
              className="ml-4 text-red-600 hover:text-red-800 text-xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-green-800 font-medium">{success}</p>
            </div>
            <button
              onClick={() => setSuccess(undefined)}
              className="ml-4 text-green-600 hover:text-green-800 text-xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Breadcrumb with Back Button */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          {(currentFolderId || folderPath.length > 0) && (
            <button
              onClick={() => {
                if (folderPath.length > 1) {
                  // Go back to parent folder
                  const parentIndex = folderPath.length - 2;
                  handleBreadcrumbClick(parentIndex);
                } else {
                  // Go back to root
                  handleBreadcrumbClick(-1);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              <span>←</span>
              <span>Back</span>
            </button>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleBreadcrumbClick(-1)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium min-h-[44px] px-2 py-1 rounded hover:bg-blue-50 transition-all duration-200"
            >
              Root
            </button>
            {folderPath.map((folder, index) => (
              <div key={folder.id} className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">/</span>
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium min-h-[44px] px-2 py-1 rounded hover:bg-blue-50 transition-all duration-200 break-words"
                >
                  {folder.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions Bar */}
        <div className="mb-6 bg-white rounded-xl shadow border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search and Filters */}
            <div className="flex-1 w-full sm:w-auto flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search files and folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] text-sm"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] text-sm"
              >
                <option value="ALL">All Types</option>
                <option value="pdf">PDF</option>
                <option value="image">Images</option>
                <option value="word">Word</option>
                <option value="excel">Excel</option>
                <option value="cad">CAD</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Admin Actions */}
            {isAdmin && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setNewFolderName("");
                    setShowCreateFolderModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium min-h-[44px] shadow-sm hover:shadow-md active:scale-95"
                >
                  + New Folder
                </button>
                <button
                  onClick={() => {
                    setUploadingFiles([]);
                    setShowUploadModal(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 text-sm font-medium min-h-[44px] shadow-sm hover:shadow-md active:scale-95"
                >
                  📤 Upload Files
                </button>
              </div>
            )}
          </div>

          {/* Sort Controls */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">Sort by:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] text-sm"
            >
              <option value="name">Name</option>
              <option value="dateModified">Date Modified</option>
              <option value="type">Type</option>
              <option value="size">Size</option>
            </select>
            <button
              onClick={() =>
                setSortDirection(sortDirection === "asc" ? "desc" : "asc")
              }
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 min-h-[44px] text-sm font-medium"
            >
              {sortDirection === "asc" ? "↑ Ascending" : "↓ Descending"}
            </button>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Modified
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Folders */}
                  {filteredAndSorted.folders.map((folder) => (
                    <tr
                      key={folder.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl sm:text-2xl flex-shrink-0">📁</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 break-words">
                              {folder.name}
                            </div>
                            <div className="text-xs text-gray-500 break-words">
                              {folder._count.files} file(s), {folder._count.children} folder(s)
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="uppercase">Folder</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateShort(folder.updatedAt.toString())}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        —
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (downloadingFolder === folder.id) return;
                              
                              setDownloadingFolder(folder.id);
                              setError(undefined);
                              
                              try {
                                const res = await fetch(`/api/operations-common/download-folder?folderId=${folder.id}`);
                                
                                if (!res.ok) {
                                  const error = await res.json().catch(() => ({ error: "Failed to download folder" }));
                                  setError(error.error || "Failed to download folder");
                                  setDownloadingFolder(null);
                                  return;
                                }
                                
                                // Get the ZIP file as blob
                                const zipBlob = await res.blob();
                                
                                // Create download link for ZIP
                                const url = window.URL.createObjectURL(zipBlob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `${folder.name}.zip`;
                                link.style.display = 'none';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                // Clean up
                                window.URL.revokeObjectURL(url);
                                
                                setSuccess(`Downloaded "${folder.name}.zip"`);
                              } catch (err: any) {
                                console.error("Error downloading ZIP:", err);
                                setError(err?.message || "Failed to download folder as ZIP");
                              } finally {
                                setDownloadingFolder(null);
                              }
                            }}
                            disabled={downloadingFolder === folder.id}
                            className="px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Download folder as ZIP"
                          >
                            {downloadingFolder === folder.id ? "Creating ZIP..." : "Download"}
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingFolder(folder);
                                  setEditingFolderName(folder.name);
                                  setShowEditFolderModal(true);
                                }}
                                className="px-3 py-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                                title="Edit folder"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingFolder(folder);
                                  setShowDeleteFolderModal(true);
                                }}
                                className="px-3 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                                title="Delete folder"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Files */}
                  {filteredAndSorted.files.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedFile(file);
                        setShowFileDetails(true);
                      }}
                    >
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl sm:text-2xl flex-shrink-0">{getFileIcon(file.fileType)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 break-words">
                              {file.name}
                            </div>
                            {file.originalName !== file.name && (
                              <div className="text-xs text-gray-500 break-words">
                                {file.originalName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">
                        {file.fileType}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateShort(file.updatedAt.toString())}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(file.fileSize)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              try {
                                // Fetch the file as blob to force download
                                const fileRes = await fetch(file.fileUrl);
                                const blob = await fileRes.blob();
                                
                                // Create download link
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = file.name;
                                link.style.display = 'none';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                // Clean up the URL object
                                window.URL.revokeObjectURL(url);
                                
                                setSuccess(`Downloaded "${file.name}"`);
                              } catch (err: any) {
                                setError(err?.message || "Failed to download file");
                              }
                            }}
                            className="px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                            title="Download file"
                          >
                            Download
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => {
                                  setRenamingFile(file);
                                  setRenamingFileName(file.name);
                                  setShowRenameFileModal(true);
                                }}
                                className="px-3 py-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                                title="Rename file"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => {
                                  setMovingFile(file);
                                  setTargetFolderId(file.folderId || null);
                                  setShowMoveFileModal(true);
                                }}
                                className="px-3 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                                title="Move file"
                              >
                                Move
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingFile(file);
                                  setShowDeleteFileModal(true);
                                }}
                                className="px-3 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                                title="Delete file"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Empty State */}
                  {filteredAndSorted.folders.length === 0 && filteredAndSorted.files.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 sm:px-6 py-12 text-center">
                        <p className="text-gray-500 text-sm break-words px-4">
                          {searchQuery || filterType !== "ALL"
                            ? "No files or folders match your search criteria."
                            : "No files or folders yet. " + (isAdmin ? "Create a folder or upload files to get started." : "")}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* File Details Panel */}
        {showFileDetails && selectedFile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">File Details</h2>
                  <button
                    onClick={() => {
                      setShowFileDetails(false);
                      setSelectedFile(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {/* File Preview/Thumbnail */}
                <div className="flex justify-center mb-6">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-4xl sm:text-6xl">{getFileIcon(selectedFile.fileType)}</span>
                  </div>
                </div>

                {/* File Info */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      File Name
                    </label>
                    <p className="text-sm text-gray-900 mt-1 break-words">{selectedFile.name}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Original Name
                    </label>
                    <p className="text-sm text-gray-900 mt-1 break-words">{selectedFile.originalName}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Type
                    </label>
                    <p className="text-sm text-gray-900 mt-1 uppercase">{selectedFile.fileType}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Size
                    </label>
                    <p className="text-sm text-gray-900 mt-1">{formatFileSize(selectedFile.fileSize)}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Location
                    </label>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedFile.folder ? selectedFile.folder.name : "Root"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Date Modified
                    </label>
                    <p className="text-sm text-gray-900 mt-1">
                      {formatDateTime(selectedFile.updatedAt.toString())}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Created By
                    </label>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedFile.creator.name || selectedFile.creator.email || "Unknown"}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-6 border-t border-gray-200 flex gap-3 flex-wrap">
                  <a
                    href={selectedFile.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium text-center min-h-[44px] flex items-center justify-center shadow-sm hover:shadow-md active:scale-95"
                  >
                    Open File
                  </a>
                  <button
                    onClick={async () => {
                      try {
                        // Fetch the file as blob to force download
                        const fileRes = await fetch(selectedFile.fileUrl);
                        const blob = await fileRes.blob();
                        
                        // Create download link
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = selectedFile.name;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Clean up the URL object
                        window.URL.revokeObjectURL(url);
                        
                        setSuccess(`Downloaded "${selectedFile.name}"`);
                        setShowFileDetails(false);
                      } catch (err: any) {
                        setError(err?.message || "Failed to download file");
                      }
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 text-sm font-medium text-center min-h-[44px] flex items-center justify-center shadow-sm hover:shadow-md active:scale-95"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Folder Modal */}
        {showCreateFolderModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Create New Folder</h2>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] text-sm"
                    placeholder="Enter folder name"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowCreateFolderModal(false);
                      setNewFolderName("");
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm font-medium min-h-[44px] active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium min-h-[44px] shadow-sm hover:shadow-md active:scale-95"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Folder Modal */}
        {showEditFolderModal && editingFolder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Edit Folder</h2>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] text-sm"
                    placeholder="Enter folder name"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowEditFolderModal(false);
                      setEditingFolder(null);
                      setEditingFolderName("");
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm font-medium min-h-[44px] active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateFolder}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium min-h-[44px] shadow-sm hover:shadow-md active:scale-95"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Folder Modal */}
        {showDeleteFolderModal && deletingFolder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Delete Folder</h2>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete the folder <strong>"{deletingFolder.name}"</strong>?
                  This will also delete all files and subfolders inside it.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowDeleteFolderModal(false);
                      setDeletingFolder(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm font-medium min-h-[44px] active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteFolder}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 text-sm font-medium min-h-[44px] shadow-sm hover:shadow-md active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Files Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Upload Files</h2>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Files
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []) as globalThis.File[];
                      setUploadingFiles(files);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
                  />
                  {uploadingFiles.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      {uploadingFiles.length} file(s) selected
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadingFiles([]);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm font-medium min-h-[44px] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFileUpload}
                    disabled={uploading || uploadingFiles.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 text-sm font-medium min-h-[44px] shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete File Modal */}
        {showDeleteFileModal && deletingFile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Delete File</h2>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete <strong>"{deletingFile.name}"</strong>?
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowDeleteFileModal(false);
                      setDeletingFile(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm font-medium min-h-[44px] active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteFile}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 text-sm font-medium min-h-[44px] shadow-sm hover:shadow-md active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Move File Modal */}
        {showMoveFileModal && movingFile && (
          <MoveFileModal
            file={movingFile}
            currentFolderId={currentFolderId}
            folders={folders}
            onMove={handleMoveFile}
            onCancel={() => {
              setShowMoveFileModal(false);
              setMovingFile(null);
              setTargetFolderId(null);
            }}
            targetFolderId={targetFolderId}
            onTargetFolderChange={setTargetFolderId}
          />
        )}

        {/* Rename File Modal */}
        {showRenameFileModal && renamingFile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Rename File</h2>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    File Name
                  </label>
                  <input
                    type="text"
                    value={renamingFileName}
                    onChange={(e) => setRenamingFileName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] text-sm"
                    placeholder="Enter file name"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowRenameFileModal(false);
                      setRenamingFile(null);
                      setRenamingFileName("");
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm font-medium min-h-[44px] active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRenameFile}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium min-h-[44px] shadow-sm hover:shadow-md active:scale-95"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Move File Modal Component
function MoveFileModal({
  file,
  currentFolderId,
  folders,
  onMove,
  onCancel,
  targetFolderId,
  onTargetFolderChange,
}: {
  file: File;
  currentFolderId: string | null;
  folders: Folder[];
  onMove: () => void;
  onCancel: () => void;
  targetFolderId: string | null;
  onTargetFolderChange: (id: string | null) => void;
}) {
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);

  useEffect(() => {
    const loadAllFolders = async () => {
      setLoadingFolders(true);
      const res = await getFolders(undefined);
      if (res.ok) {
        setAllFolders(res.folders || []);
      }
      setLoadingFolders(false);
    };
    loadAllFolders();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Move File</h2>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Move "{file.name}" to:
            </label>
            <select
              value={targetFolderId || ""}
              onChange={(e) => onTargetFolderChange(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] text-sm"
            >
              <option value="">Root (No Folder)</option>
              {loadingFolders ? (
                <option disabled>Loading folders...</option>
              ) : (
                allFolders
                  .filter((f) => f.id !== file.folderId)
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))
              )}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm font-medium min-h-[44px] active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={onMove}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium min-h-[44px] shadow-sm hover:shadow-md active:scale-95"
            >
              Move
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

