"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { z } from "zod";

const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  description: z.string().optional(),
  photos: z.array(z.string()).nullable().optional(),
  category: z.string().optional(),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  unit: z.string().min(1, "Unit is required"),
  minStockLevel: z.number().int().min(0, "Min stock level cannot be negative"),
  location: z.string().optional(),
  supplier: z.string().optional(),
  costPerUnit: z.number().min(0, "Cost cannot be negative").optional(),
});

const adjustmentSchema = z.object({
  itemId: z.string(),
  quantityChange: z.number().int(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export async function getInventoryItems() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.error("[Inventory] getInventoryItems: Not authenticated");
      return { ok: false, error: "Not authenticated" };
    }

    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: "asc" },
    });

    // Parse photos JSON strings to arrays
    const itemsWithParsedPhotos = items.map((item: any) => ({
      ...item,
      photos: item.photos ? (() => {
        try {
          const parsed = JSON.parse(item.photos);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })() : null,
    }));

    return { ok: true, items: itemsWithParsedPhotos };
  } catch (error: any) {
    console.error("[Inventory] getInventoryItems error:", error);
    return { ok: false, error: "Failed to load inventory items" };
  }
}

export async function createInventoryItem(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only managers and admins can create items
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only managers and admins can create inventory items" };
  }

  const data = {
    name: formData.get("name"),
    sku: formData.get("sku") || undefined,
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
    quantity: Number(formData.get("quantity")) || 0,
    unit: formData.get("unit") || "pcs",
    minStockLevel: Number(formData.get("minStockLevel")) || 0,
    location: formData.get("location") || undefined,
    supplier: formData.get("supplier") || undefined,
    costPerUnit: formData.get("costPerUnit") ? Number(formData.get("costPerUnit")) : undefined,
  };

  const parsed = itemSchema.safeParse(data);

  if (!parsed.success) {
    console.error("[Inventory] createInventoryItem validation error:", parsed.error.errors);
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    const item = await prisma.inventoryItem.create({
      data: {
        name: parsed.data.name,
        sku: parsed.data.sku || null,
        description: parsed.data.description || null,
        photos: parsed.data.photos ? JSON.stringify(parsed.data.photos) : null,
        category: parsed.data.category || null,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        minStockLevel: parsed.data.minStockLevel,
        location: parsed.data.location || null,
        supplier: parsed.data.supplier || null,
        costPerUnit: parsed.data.costPerUnit || null,
      } as any, // Type assertion needed until Prisma client is regenerated
    });

    console.log("[Inventory] createInventoryItem success:", item.id);
    return { ok: true, item };
  } catch (error: any) {
    console.error("[Inventory] createInventoryItem error:", error);
    if (error.code === "P2002") {
      return { ok: false, error: "SKU already exists" };
    }
    return { ok: false, error: "Failed to create item" };
  }
}

export async function updateInventoryItem(itemId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only managers and admins can update items
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only managers and admins can update inventory items" };
  }

  // Parse photos from JSON string if provided
  let photos: string[] | null = null;
  const photosJson = formData.get("photos");
  if (photosJson && typeof photosJson === "string") {
    try {
      const parsed = JSON.parse(photosJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        photos = parsed;
      }
    } catch (e) {
      console.error("Failed to parse photos JSON:", e);
    }
  }

  const data = {
    name: formData.get("name"),
    sku: formData.get("sku") || undefined,
    description: formData.get("description") || undefined,
    photos: photos,
    category: formData.get("category") || undefined,
    quantity: Number(formData.get("quantity")) || 0,
    unit: formData.get("unit") || "pcs",
    minStockLevel: Number(formData.get("minStockLevel")) || 0,
    location: formData.get("location") || undefined,
    supplier: formData.get("supplier") || undefined,
    costPerUnit: formData.get("costPerUnit") ? Number(formData.get("costPerUnit")) : undefined,
  };

  const parsed = itemSchema.safeParse(data);

  if (!parsed.success) {
    console.error("[Inventory] updateInventoryItem validation error:", parsed.error.errors);
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    const item = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        name: parsed.data.name,
        sku: parsed.data.sku || null,
        description: parsed.data.description || null,
        photos: parsed.data.photos ? JSON.stringify(parsed.data.photos) : null,
        category: parsed.data.category || null,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        minStockLevel: parsed.data.minStockLevel,
        location: parsed.data.location || null,
        supplier: parsed.data.supplier || null,
        costPerUnit: parsed.data.costPerUnit || null,
      } as any, // Type assertion needed until Prisma client is regenerated
    });

    console.log("[Inventory] updateInventoryItem success:", itemId);
    return { ok: true, item };
  } catch (error: any) {
    console.error("[Inventory] updateInventoryItem error:", error, "itemId:", itemId);
    if (error.code === "P2002") {
      return { ok: false, error: "SKU already exists" };
    }
    if (error.code === "P2025") {
      return { ok: false, error: "Item not found" };
    }
    return { ok: false, error: "Failed to update item" };
  }
}

export async function deleteInventoryItem(itemId: string) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.error("[Inventory] deleteInventoryItem: Not authenticated");
      return { ok: false, error: "Not authenticated" };
    }

    const userRole = (session.user as any).role;

    // Only admins can delete items
    if (userRole !== "ADMIN") {
      console.error("[Inventory] deleteInventoryItem: Unauthorized", { userId: (session.user as any).id, role: userRole });
      return { ok: false, error: "Unauthorized: Only admins can delete inventory items" };
    }

    await prisma.inventoryItem.delete({ where: { id: itemId } });
    console.log("[Inventory] deleteInventoryItem success:", itemId);

    return { ok: true };
  } catch (error: any) {
    console.error("[Inventory] deleteInventoryItem error:", error, "itemId:", itemId);
    if (error.code === "P2025") {
      return { ok: false, error: "Item not found" };
    }
    return { ok: false, error: "Failed to delete item" };
  }
}

export async function adjustInventory(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  // Only managers and admins can adjust inventory
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only managers and admins can adjust inventory" };
  }

  const data = {
    itemId: formData.get("itemId") as string,
    quantityChange: Number(formData.get("quantityChange")),
    reason: formData.get("reason") as string | undefined,
    notes: formData.get("notes") as string | undefined,
  };

  const parsed = adjustmentSchema.safeParse(data);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    // Get current item
    const item = await prisma.inventoryItem.findUnique({
      where: { id: parsed.data.itemId },
    });

    if (!item) {
      return { ok: false, error: "Item not found" };
    }

    const newQuantity = item.quantity + parsed.data.quantityChange;

    if (newQuantity < 0) {
      return { ok: false, error: "Insufficient quantity in stock" };
    }

    // Create adjustment record and update item in a transaction
    const [adjustment, updatedItem] = await prisma.$transaction([
      prisma.inventoryAdjustment.create({
        data: {
          itemId: parsed.data.itemId,
          userId,
          quantityChange: parsed.data.quantityChange,
          reason: parsed.data.reason || null,
          notes: parsed.data.notes || null,
        },
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.inventoryItem.update({
        where: { id: parsed.data.itemId },
        data: { quantity: newQuantity },
      }),
    ]);

    return { ok: true, adjustment, item: updatedItem };
  } catch (error: any) {
    console.error("[Inventory] adjustInventory error:", error, "itemId:", parsed.data.itemId, "quantityChange:", parsed.data.quantityChange);
    return { ok: false, error: "Failed to adjust inventory" };
  }
}

export async function getItemAdjustments(itemId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const adjustments = await prisma.inventoryAdjustment.findMany({
    where: { itemId },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50, // Last 50 adjustments
  });

  return { ok: true, adjustments };
}

export async function getLowStockItems() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const items = await prisma.inventoryItem.findMany({
    where: {
      quantity: {
        lte: prisma.inventoryItem.fields.minStockLevel,
      },
    },
    orderBy: { name: "asc" },
  });

  return { ok: true, items };
}



