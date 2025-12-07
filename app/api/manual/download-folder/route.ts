import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

// Helper function to get all files in a folder (recursively)
async function getAllFilesInFolder(folderId: string): Promise<Array<{ name: string; url: string; path: string }>> {
  const files: Array<{ name: string; url: string; path: string }> = [];
  
  // Get direct files in this folder
  const directFiles = await prisma.manualFile.findMany({
    where: { folderId },
    select: {
      name: true,
      fileUrl: true,
    },
  });
  
  directFiles.forEach((file) => {
    files.push({
      name: file.name,
      url: file.fileUrl,
      path: file.name,
    });
  });
  
  // Get subfolders and their files recursively
  const subfolders = await prisma.manualFolder.findMany({
    where: { parentId: folderId },
    select: { id: true, name: true },
  });
  
  for (const subfolder of subfolders) {
    const subfolderFiles = await getAllFilesInFolder(subfolder.id);
    subfolderFiles.forEach((file) => {
      files.push({
        name: file.name,
        url: file.url,
        path: `${subfolder.name}/${file.path}`,
      });
    });
  }
  
  return files;
}

export async function GET(
  request: NextRequest,
  { params }: { params?: { folderId?: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    // Get folder info
    const folder = await prisma.manualFolder.findUnique({
      where: { id: folderId },
      select: { name: true },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Get all files in folder (recursively)
    const files = await getAllFilesInFolder(folderId);

    if (files.length === 0) {
      return NextResponse.json({ error: "Folder is empty" }, { status: 400 });
    }

    // Create ZIP file using JSZip (we'll need to install it or use a different approach)
    // For now, return a JSON response with file URLs and let the client handle ZIP creation
    // Or we can use a server-side ZIP library
    
    // Using a simpler approach: return file list and let client download individually
    // Or use a library like 'archiver' or 'jszip' on the server
    
    // For now, let's use a client-side approach or return the files list
    // The client can download them or we can create ZIP server-side
    
    // Simple approach: Return file URLs for client to handle
    return NextResponse.json({
      folderName: folder.name,
      files: files.map((f) => ({
        name: f.name,
        url: f.url,
        path: f.path,
      })),
    });
  } catch (error: any) {
    console.error("Error downloading folder:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to download folder" },
      { status: 500 }
    );
  }
}

