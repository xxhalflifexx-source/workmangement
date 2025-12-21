"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
    return { ok: false, error: error?.message || "Failed to delete template" };
  }
}

