"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

// Get all folders (with optional parent filter)
export async function getFolders(parentId?: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const folders = await prisma.manualFolder.findMany({
      where: parentId === undefined ? { parentId: null } : parentId === null ? { parentId: null } : { parentId },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return { ok: true, folders };
  } catch (error: any) {
    console.error("Error loading folders:", error);
    return { ok: false, error: error?.message || "Failed to load folders" };
  }
}

// Get all files (with optional folder filter)
export async function getFiles(folderId?: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const files = await prisma.manualFile.findMany({
      where: folderId === undefined ? { folderId: null } : folderId === null ? { folderId: null } : { folderId },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { ok: true, files };
  } catch (error: any) {
    console.error("Error loading files:", error);
    return { ok: false, error: error?.message || "Failed to load files" };
  }
}

// Create folder (Admin only)
export async function createFolder(name: string, parentId?: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can create folders" };
  }

  if (!name || name.trim().length === 0) {
    return { ok: false, error: "Folder name is required" };
  }

  try {
    const folder = await prisma.manualFolder.create({
      data: {
        name: name.trim(),
        parentId: parentId || null,
        createdBy: (session.user as any).id,
      },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
    });

    return { ok: true, folder };
  } catch (error: any) {
    console.error("Error creating folder:", error);
    return { ok: false, error: error?.message || "Failed to create folder" };
  }
}

// Update folder (Admin only)
export async function updateFolder(folderId: string, name: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can update folders" };
  }

  if (!name || name.trim().length === 0) {
    return { ok: false, error: "Folder name is required" };
  }

  try {
    const folder = await prisma.manualFolder.update({
      where: { id: folderId },
      data: {
        name: name.trim(),
      },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
    });

    return { ok: true, folder };
  } catch (error: any) {
    console.error("Error updating folder:", error);
    return { ok: false, error: error?.message || "Failed to update folder" };
  }
}

// Delete folder (Admin only)
export async function deleteFolder(folderId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can delete folders" };
  }

  try {
    // Check if folder has children or files
    const folder = await prisma.manualFolder.findUnique({
      where: { id: folderId },
      include: {
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
    });

    if (!folder) {
      return { ok: false, error: "Folder not found" };
    }

    // Delete folder (cascade will handle children and files)
    await prisma.manualFolder.delete({
      where: { id: folderId },
    });

    return { ok: true };
  } catch (error: any) {
    console.error("Error deleting folder:", error);
    return { ok: false, error: error?.message || "Failed to delete folder" };
  }
}

// Create file record (Admin only)
export async function createFile(
  name: string,
  originalName: string,
  fileType: string,
  fileSize: number,
  fileUrl: string,
  folderId?: string | null
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can upload files" };
  }

  if (!name || name.trim().length === 0) {
    return { ok: false, error: "File name is required" };
  }

  if (!fileUrl) {
    return { ok: false, error: "File URL is required" };
  }

  try {
    const file = await prisma.manualFile.create({
      data: {
        name: name.trim(),
        originalName,
        fileType,
        fileSize,
        fileUrl,
        folderId: folderId || null,
        createdBy: (session.user as any).id,
      },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return { ok: true, file };
  } catch (error: any) {
    console.error("Error creating file:", error);
    return { ok: false, error: error?.message || "Failed to create file" };
  }
}

// Update file (Admin only)
export async function updateFile(fileId: string, name?: string, folderId?: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can update files" };
  }

  try {
    const updateData: any = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (folderId !== undefined) {
      updateData.folderId = folderId || null;
    }

    const file = await prisma.manualFile.update({
      where: { id: fileId },
      data: updateData,
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return { ok: true, file };
  } catch (error: any) {
    console.error("Error updating file:", error);
    return { ok: false, error: error?.message || "Failed to update file" };
  }
}

// Delete file (Admin only)
export async function deleteFile(fileId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can delete files" };
  }

  try {
    const file = await prisma.manualFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return { ok: false, error: "File not found" };
    }

    // Delete file record (file in storage should be deleted separately via API)
    await prisma.manualFile.delete({
      where: { id: fileId },
    });

    return { ok: true, fileUrl: file.fileUrl };
  } catch (error: any) {
    console.error("Error deleting file:", error);
    return { ok: false, error: error?.message || "Failed to delete file" };
  }
}

// Get file by ID
export async function getFile(fileId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const file = await prisma.manualFile.findUnique({
      where: { id: fileId },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!file) {
      return { ok: false, error: "File not found" };
    }

    return { ok: true, file };
  } catch (error: any) {
    console.error("Error loading file:", error);
    return { ok: false, error: error?.message || "Failed to load file" };
  }
}

