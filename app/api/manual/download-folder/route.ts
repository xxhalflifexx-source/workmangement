import { NextRequest, NextResponse } from "next/server";
import { getSafeServerSession } from "@/lib/api-auth";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import { Readable } from "stream";

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

export async function GET(request: NextRequest) {
  try {
    const session = await getSafeServerSession(request);
    if (!session?.user) {
      return NextResponse.json({ 
        error: "Not authenticated. Please ensure cookies are enabled." 
      }, { status: 401 });
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

    // Create ZIP file using archiver
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    // Collect all chunks
    const chunks: Buffer[] = [];
    
    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("error", (err) => {
      console.error("Archive error:", err);
    });

    // Download and add each file to the ZIP
    for (const file of files) {
      try {
        const fileResponse = await fetch(file.url);
        if (!fileResponse.ok) {
          console.error(`Failed to fetch ${file.name}`);
          continue;
        }
        
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Add file to ZIP with its path
        archive.append(buffer, { name: file.path || file.name });
      } catch (fileErr) {
        console.error(`Error adding ${file.name} to ZIP:`, fileErr);
      }
    }

    // Finalize the archive
    archive.finalize();

    // Wait for archive to finish
    await new Promise<void>((resolve, reject) => {
      archive.on("end", () => resolve());
      archive.on("error", (err) => reject(err));
    });

    // Combine all chunks into a single buffer
    const zipBuffer = Buffer.concat(chunks);

    // Return ZIP file as download
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(folder.name)}.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error creating ZIP:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create ZIP file" },
      { status: 500 }
    );
  }
}

