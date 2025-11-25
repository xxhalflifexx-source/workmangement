"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { z } from "zod";
import { nowInCentral, centralToUTC } from "@/lib/date-utils";

// Set timezone for Node.js process
if (typeof process !== "undefined") {
  process.env.TZ = "America/Chicago";
}

const requestSchema = z.object({
  jobId: z.string().optional(),
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(9, "Quantity must be a single digit (1-9)"),
  unit: z.string().min(1, "Unit is required"),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  notes: z.string().optional(),
});

const updateRequestSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "FULFILLED", "ON_HOLD"]),
  notes: z.string().optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(9, "Quantity must be a single digit (1-9)").optional(),
  recommendedAction: z.enum(["PENDING", "APPROVE", "PARTIAL", "REJECTED"]).optional(),
  orderStatus: z.enum(["TO_ORDER", "ORDERED", "RECEIVED"]).optional(),
});

// Generate next request number (MR0001, MR0002, etc.)
export async function getNextRequestNumber(): Promise<string> {
  try {
    // Find all requests with request numbers matching MR#### pattern
    // Use raw query to handle case where column might not exist yet
    const allRequests = await prisma.materialRequest.findMany({
      select: {
        id: true,
        requestedDate: true,
      },
      orderBy: {
        requestedDate: "desc",
      },
    });

    // Try to get requestNumber if column exists
    // Note: This will work once the migration is applied
    // For now, we'll use a count-based approach as fallback
    let requestNumbers: string[] = [];
    try {
      // Use a try-catch to handle case where column might not exist
      const requestsWithNumbers = await prisma.materialRequest.findMany({
        where: {
          requestNumber: {
            not: null,
          },
        },
        select: {
          requestNumber: true,
        },
        orderBy: {
          requestedDate: "desc",
        },
      });
      requestNumbers = requestsWithNumbers
        .map((r) => r.requestNumber)
        .filter((rn): rn is string => rn !== null);
    } catch (err: any) {
      // Column doesn't exist yet, use fallback
      if (err?.code === "P2022" || err?.message?.includes("requestNumber")) {
        console.log("requestNumber column not found, using count-based fallback");
      } else {
        throw err; // Re-throw if it's a different error
      }
    }

    let nextSequence = 1;

    if (requestNumbers.length > 0) {
      // Extract sequence numbers from all requests
      const sequences = requestNumbers
        .map((rn) => {
          // Match pattern MR#### and extract the 4-digit sequence
          const match = rn.match(/MR(\d{4})$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((seq) => seq > 0);

      if (sequences.length > 0) {
        // Find the highest sequence number and increment
        const maxSequence = Math.max(...sequences);
        nextSequence = maxSequence + 1;
      }
    } else {
      // Fallback: generate based on count
      nextSequence = allRequests.length + 1;
    }

    // Format as MR#### with 4-digit sequence padded with zeros
    return `MR${nextSequence.toString().padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating request number:", error);
    // Fallback: generate based on count
    const count = await prisma.materialRequest.count();
    return `MR${(count + 1).toString().padStart(4, "0")}`;
  }
}

export async function createMaterialRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;

  const data = {
    jobId: formData.get("jobId") as string | undefined,
    itemName: formData.get("itemName") as string,
    quantity: Number(formData.get("quantity")),
    unit: formData.get("unit") as string,
    description: formData.get("description") as string | undefined,
    priority: formData.get("priority") as string || "MEDIUM",
    notes: formData.get("notes") as string | undefined,
  };

  const parsed = requestSchema.safeParse(data);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    // Generate request number
    const requestNumber = await getNextRequestNumber();

    const request = await prisma.materialRequest.create({
      data: {
        requestNumber,
        jobId: parsed.data.jobId || null,
        userId,
        itemName: parsed.data.itemName,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        description: parsed.data.description || null,
        priority: parsed.data.priority,
        notes: parsed.data.notes || null,
      },
      include: {
        job: { select: { title: true, id: true } },
        user: { select: { name: true, email: true } },
      },
    });

    return { ok: true, request };
  } catch (error) {
    console.error("Create material request error:", error);
    return { ok: false, error: "Failed to create material request" };
  }
}

export async function getMaterialRequests() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  try {
    // Employees see only their requests, managers/admins see all
    // Use select to avoid querying columns that might not exist yet
    const requests = await prisma.materialRequest.findMany({
      where: userRole === "EMPLOYEE" ? { userId } : {},
      select: {
        id: true,
        requestNumber: true,
        jobId: true,
        userId: true,
        itemName: true,
        quantity: true,
        unit: true,
        description: true,
        priority: true,
        status: true,
        requestedDate: true,
        fulfilledDate: true,
        dateDelivered: true,
        notes: true,
        recommendedAction: true,
        orderStatus: true,
        job: { select: { title: true, id: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { requestedDate: "desc" },
    });

    return { ok: true, requests };
  } catch (error: any) {
    // Handle case where columns don't exist yet - try with minimal fields
    if (error?.code === "P2022" || error?.message?.includes("requestNumber") || error?.message?.includes("dateDelivered") || error?.message?.includes("orderStatus")) {
      console.error("Database migration needed: MaterialRequest columns missing, trying fallback query");
      
      // Fallback: query only fields that definitely exist
      try {
        const requests = await prisma.materialRequest.findMany({
          where: userRole === "EMPLOYEE" ? { userId } : {},
          select: {
            id: true,
            jobId: true,
            userId: true,
            itemName: true,
            quantity: true,
            unit: true,
            description: true,
            priority: true,
            status: true,
            requestedDate: true,
            fulfilledDate: true,
            notes: true,
            job: { select: { title: true, id: true } },
            user: { select: { name: true, email: true } },
          },
          orderBy: { requestedDate: "desc" },
        });

        // Add null values for missing fields
        const requestsWithDefaults = requests.map((req: any) => ({
          ...req,
          requestNumber: null,
          dateDelivered: null,
          orderStatus: null,
          recommendedAction: null,
        }));

        return { ok: true, requests: requestsWithDefaults };
      } catch (fallbackError: any) {
        console.error("Fallback query also failed:", fallbackError);
        return { ok: false, error: "Database migration required. Please run: ALTER TABLE \"MaterialRequest\" ADD COLUMN IF NOT EXISTS \"dateDelivered\" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS \"orderStatus\" TEXT, ADD COLUMN IF NOT EXISTS \"requestNumber\" TEXT, ADD COLUMN IF NOT EXISTS \"recommendedAction\" TEXT;" };
      }
    }
    console.error("Get material requests error:", error);
    return { ok: false, error: "Failed to load material requests" };
  }
}

// Get inventory items for dropdown
export async function getInventoryItemsForRequest() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const items = await prisma.inventoryItem.findMany({
      select: {
        id: true,
        name: true,
        quantity: true,
        unit: true,
        minStockLevel: true,
      },
      orderBy: { name: "asc" },
    });

    return { ok: true, items };
  } catch (error) {
    console.error("Get inventory items error:", error);
    return { ok: false, error: "Failed to load inventory items" };
  }
}

export async function getJobMaterialRequests(jobId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  // Check if user has access to this job
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { assignedTo: true, createdBy: true },
  });

  if (!job) {
    return { ok: false, error: "Job not found" };
  }

  // Only allow access if user is assigned, creator, or manager/admin
  if (
    userRole !== "ADMIN" &&
    userRole !== "MANAGER" &&
    job.assignedTo !== userId &&
    job.createdBy !== userId
  ) {
    return { ok: false, error: "Access denied" };
  }

  const requests = await prisma.materialRequest.findMany({
    where: { jobId },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { requestedDate: "desc" },
  });

  return { ok: true, requests };
}

export async function updateMaterialRequest(requestId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only managers and admins can update requests
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only managers and admins can update requests" };
  }

  const rawQuantity = formData.get("quantity") as string | null;
  const quantity = rawQuantity != null && rawQuantity !== "" ? Number(rawQuantity) : undefined;

  // Check if we're only updating recommendedAction or orderStatus (manual-only fields)
  const recommendedAction = formData.get("recommendedAction") as string | null;
  const orderStatus = formData.get("orderStatus") as string | null;
  const isOnlyUpdatingManualFields = (recommendedAction || orderStatus) && !formData.get("notes") && quantity === undefined;

  // Fetch existing request first to get current status and job relation
  const existing = await prisma.materialRequest.findUnique({
    where: { id: requestId },
    include: { job: { select: { id: true, title: true } } },
  });

  if (!existing) {
    return { ok: false, error: "Material request not found" };
  }

  // Use existing status if we're only updating manual fields, otherwise use provided status
  const statusValue = isOnlyUpdatingManualFields ? existing.status : (formData.get("status") as string || existing.status);

  const data = {
    status: statusValue,
    notes: formData.get("notes") as string | undefined,
    quantity: quantity,
  };

  const parsed = updateRequestSchema.safeParse(data);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    // Parse optional amount for creating JobExpense when approving
    const rawAmount = formData.get("amount") as string | null;
    const amount = rawAmount != null && rawAmount !== "" ? parseFloat(rawAmount) : undefined;
    if (rawAmount && (amount == null || isNaN(amount))) {
      return { ok: false, error: "Invalid amount" };
    }

    const updateData: any = {};

    // Only update status if it's actually changing (not when only updating Recommended Action)
    const currentStatus = existing?.status || parsed.data.status;
    const newStatus = parsed.data.status;
    const statusChanged = existing && existing.status !== newStatus;
    if (statusChanged) {
      updateData.status = newStatus;
    } else if (!isOnlyUpdatingManualFields) {
      // Only set status if we're not just updating manual fields
      updateData.status = parsed.data.status;
    }

    // Update notes if provided
    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes || null;
    }

    // Update quantity if provided
    if (parsed.data.quantity !== undefined) {
      updateData.quantity = parsed.data.quantity;
    }

    // Update recommended action if provided (admin/manager only)
    // This is a MANUAL-ONLY field and does NOT trigger status changes or inventory updates
    if (recommendedAction && (recommendedAction === "PENDING" || recommendedAction === "APPROVE" || recommendedAction === "PARTIAL" || recommendedAction === "REJECTED")) {
      updateData.recommendedAction = recommendedAction;
    }

    // Update order status if provided (admin/manager only)
    // This is a MANUAL-ONLY field and does NOT trigger inventory updates
    if (orderStatus !== null) {
      if (orderStatus === "" || orderStatus === "TO_ORDER" || orderStatus === "ORDERED" || orderStatus === "RECEIVED") {
        updateData.orderStatus = orderStatus === "" ? null : orderStatus;
      }
    }

    // Set date delivered if order status is RECEIVED
    const dateDelivered = formData.get("dateDelivered") as string | null;
    if (dateDelivered && orderStatus === "RECEIVED") {
      updateData.dateDelivered = new Date(dateDelivered);
    }

    // Only set fulfilled date if status is ACTUALLY CHANGING to APPROVED or FULFILLED
    // Do NOT set this when only updating Recommended Action
    if (statusChanged) {
      if (newStatus === "APPROVED") {
        // Set approval date if not already set
        if (!existing?.fulfilledDate) {
          updateData.fulfilledDate = centralToUTC(nowInCentral().toDate());
        }
      } else if (newStatus === "FULFILLED") {
        // Always set fulfillment date when status changes to FULFILLED
        updateData.fulfilledDate = centralToUTC(nowInCentral().toDate());
      }
    }

    const request = await prisma.materialRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        job: { select: { title: true, id: true } },
        user: { select: { name: true, email: true } },
      },
    });

    // On approval, export to financials by creating a JobExpense if amount provided
    // ONLY create JobExpense if status ACTUALLY CHANGED to APPROVED (not when only updating Recommended Action)
    if (statusChanged && newStatus === "APPROVED" && amount && amount > 0) {
      try {
        await prisma.jobExpense.create({
          data: {
            jobId: (request.job?.id || existing?.job?.id) ?? undefined as any,
            userId: (session.user as any).id,
            category: "Materials",
            description: request.itemName,
            amount,
            quantity: request.quantity,
            unit: request.unit,
            notes: request.description || null,
          },
        });
      } catch (e) {
        console.error("Failed to create JobExpense from material approval:", e);
        // Do not fail the request update if expense creation fails
      }
    }

    // IMPORTANT: Recommended Action updates are MANUAL-ONLY
    // They do NOT trigger:
    // - Status changes
    // - Inventory count changes
    // - JobExpense creation
    // - Any automatic calculations

    return { ok: true, request };
  } catch (error) {
    console.error("Update material request error:", error);
    return { ok: false, error: "Failed to update material request" };
  }
}

export async function deleteMaterialRequest(requestId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  // Get the request to check ownership
  const request = await prisma.materialRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, status: true },
  });

  if (!request) {
    return { ok: false, error: "Request not found" };
  }

  // Only allow deletion if user is the creator, admin, or if request is still pending
  if (
    userRole !== "ADMIN" &&
    request.userId !== userId &&
    request.status !== "PENDING"
  ) {
    return { ok: false, error: "Unauthorized: Can only delete pending requests" };
  }

  await prisma.materialRequest.delete({ where: { id: requestId } });

  return { ok: true };
}

export async function getPendingRequests() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only managers and admins can see pending requests
  if (userRole !== "MANAGER" && userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  const requests = await prisma.materialRequest.findMany({
    where: { status: "PENDING" },
    include: {
      job: { select: { title: true, id: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: [
      { priority: "desc" },
      { requestedDate: "asc" },
    ],
  });

  return { ok: true, requests };
}
