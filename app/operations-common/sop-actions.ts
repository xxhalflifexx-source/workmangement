"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  isTableMissingError,
  extractTableNameFromError,
  getMissingTableError,
} from "@/lib/db-health-check";

// ============ SOP Documents ============

export async function getSOPDocuments(folderId: string | null) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const documents = await prisma.sOPDocument.findMany({
      where: { folderId: folderId || null },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return { ok: true, documents };
  } catch (error: any) {
    console.error("Error getting SOP documents:", error);
    
    // Check if this is a missing table error
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPDocument";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to get documents" };
  }
}

export async function getSOPDocument(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const document = await prisma.sOPDocument.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        folder: { select: { id: true, name: true } },
      },
    });

    if (!document) {
      return { ok: false, error: "Document not found" };
    }

    return { ok: true, document };
  } catch (error: any) {
    console.error("Error getting SOP document:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPDocument";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to get document" };
  }
}

export async function createSOPDocument(
  title: string,
  content: string,
  folderId: string | null
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER" && userRole !== "EMPLOYEE") {
      return { ok: false, error: "Unauthorized" };
    }

    const document = await prisma.sOPDocument.create({
      data: {
        title,
        content,
        folderId: folderId || null,
        createdBy: (session.user as any).id,
      },
    });

    revalidatePath("/operations-common");
    return { ok: true, document };
  } catch (error: any) {
    console.error("Error creating SOP document:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPDocument";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to create document" };
  }
}

export async function updateSOPDocument(
  id: string,
  title?: string,
  content?: string,
  folderId?: string | null
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER" && userRole !== "EMPLOYEE") {
      return { ok: false, error: "Unauthorized" };
    }

    const updateData: any = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (folderId !== undefined) updateData.folderId = folderId;

    const document = await prisma.sOPDocument.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/operations-common");
    return { ok: true, document };
  } catch (error: any) {
    console.error("Error updating SOP document:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPDocument";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to update document" };
  }
}

export async function deleteSOPDocument(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return { ok: false, error: "Unauthorized" };
    }

    await prisma.sOPDocument.delete({ where: { id } });

    revalidatePath("/operations-common");
    return { ok: true };
  } catch (error: any) {
    console.error("Error deleting SOP document:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPDocument";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to delete document" };
  }
}

// ============ SOP Templates ============

export async function getSOPTemplates() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const templates = await prisma.sOPTemplate.findMany({
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { name: "asc" },
    });

    return { ok: true, templates };
  } catch (error: any) {
    console.error("Error getting SOP templates:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPTemplate";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to get templates" };
  }
}

export async function getSOPTemplate(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const template = await prisma.sOPTemplate.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    if (!template) {
      return { ok: false, error: "Template not found" };
    }

    return { ok: true, template };
  } catch (error: any) {
    console.error("Error getting SOP template:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPTemplate";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to get template" };
  }
}

export async function createSOPTemplate(
  name: string,
  content: string,
  description?: string
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return { ok: false, error: "Only admins and managers can create templates" };
    }

    const template = await prisma.sOPTemplate.create({
      data: {
        name,
        content,
        description: description || null,
        createdBy: (session.user as any).id,
      },
    });

    revalidatePath("/operations-common");
    return { ok: true, template };
  } catch (error: any) {
    console.error("Error creating SOP template:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPTemplate";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to create template" };
  }
}

export async function updateSOPTemplate(
  id: string,
  name?: string,
  content?: string,
  description?: string
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return { ok: false, error: "Unauthorized" };
    }

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;
    if (description !== undefined) updateData.description = description;

    const template = await prisma.sOPTemplate.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/operations-common");
    return { ok: true, template };
  } catch (error: any) {
    console.error("Error updating SOP template:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPTemplate";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to update template" };
  }
}

export async function deleteSOPTemplate(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return { ok: false, error: "Unauthorized" };
    }

    await prisma.sOPTemplate.delete({ where: { id } });

    revalidatePath("/operations-common");
    return { ok: true };
  } catch (error: any) {
    console.error("Error deleting SOP template:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPTemplate";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to delete template" };
  }
}

// ============ Employee Handbook Management ============

/**
 * Ensure Employee Handbook folder and document exist
 * This creates them if they don't exist, making the migration seamless
 */
export async function ensureEmployeeHandbook() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    // Only admins and managers can ensure the handbook exists
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return { ok: false, error: "Unauthorized" };
    }

    // Check if Employee Handbook folder exists
    let handbookFolder = await prisma.operationsCommonFolder.findFirst({
      where: { name: "Employee Handbook", parentId: null },
    });

    // Create folder if it doesn't exist
    if (!handbookFolder) {
      handbookFolder = await prisma.operationsCommonFolder.create({
        data: {
          name: "Employee Handbook",
          parentId: null,
          createdBy: userId,
        },
      });
    }

    // Check if Employee Handbook document exists
    let handbookDoc = await prisma.sOPDocument.findFirst({
      where: { 
        title: "Employee Handbook",
        folderId: handbookFolder.id,
      },
    });

    // Create default document if it doesn't exist
    if (!handbookDoc) {
      const defaultContent = `
        <h1>Employee Handbook</h1>
        <p>Welcome to the Employee Handbook. This document contains important information about company policies, procedures, and guidelines.</p>
        <p>Please review this document regularly and contact management if you have any questions.</p>
        <h2>Getting Started</h2>
        <p>This handbook is managed by administrators and can be updated at any time. Check back regularly for updates.</p>
      `;
      
      handbookDoc = await prisma.sOPDocument.create({
        data: {
          title: "Employee Handbook",
          content: defaultContent.trim(),
          folderId: handbookFolder.id,
          createdBy: userId,
        },
      });
    }

    revalidatePath("/operations-common");
    return { 
      ok: true, 
      folderId: handbookFolder.id,
      documentId: handbookDoc.id,
    };
  } catch (error: any) {
    console.error("Error ensuring Employee Handbook:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "OperationsCommonFolder";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to ensure Employee Handbook" };
  }
}

/**
 * Get Employee Handbook document
 */
export async function getEmployeeHandbook() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    // Find Employee Handbook folder
    const handbookFolder = await prisma.operationsCommonFolder.findFirst({
      where: { name: "Employee Handbook", parentId: null },
    });

    if (!handbookFolder) {
      return { ok: false, error: "Employee Handbook folder not found" };
    }

    // Find Employee Handbook document
    const handbookDoc = await prisma.sOPDocument.findFirst({
      where: { 
        title: "Employee Handbook",
        folderId: handbookFolder.id,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        folder: { select: { id: true, name: true } },
      },
    });

    if (!handbookDoc) {
      return { ok: false, error: "Employee Handbook document not found" };
    }

    return { ok: true, document: handbookDoc, folderId: handbookFolder.id };
  } catch (error: any) {
    console.error("Error getting Employee Handbook:", error);
    
    if (isTableMissingError(error)) {
      const tableName = extractTableNameFromError(error) || "SOPDocument";
      return {
        ok: false,
        error: getMissingTableError(tableName),
      };
    }
    
    return { ok: false, error: error?.message || "Failed to get Employee Handbook" };
  }
}

