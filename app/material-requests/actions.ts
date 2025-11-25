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
  recommendedAction: z.enum(["APPROVE", "PARTIAL", "DENY"]).optional(),
});

// Generate next request number (MR0001, MR0002, etc.)
export async function getNextRequestNumber(): Promise<string> {
  try {
    // Find all requests with request numbers matching MR#### pattern
    const allRequests = await prisma.materialRequest.findMany({
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

    let nextSequence = 1;

    if (allRequests.length > 0) {
      // Extract sequence numbers from all requests
      const sequences = allRequests
        .map((req) => {
          // Match pattern MR#### and extract the 4-digit sequence
          const match = req.requestNumber?.match(/MR(\d{4})$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((seq) => seq > 0);

      if (sequences.length > 0) {
        // Find the highest sequence number and increment
        const maxSequence = Math.max(...sequences);
        nextSequence = maxSequence + 1;
      }
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

  // Employees see only their requests, managers/admins see all
  const requests = await prisma.materialRequest.findMany({
    where: userRole === "EMPLOYEE" ? { userId } : {},
    include: {
      job: { select: { title: true, id: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { requestedDate: "desc" },
  });

  return { ok: true, requests };
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

  const data = {
    status: formData.get("status") as string,
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

    // Fetch request to get job relation before updating
    const existing = await prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: { job: { select: { id: true, title: true } } },
    });

    const updateData: any = {
      status: parsed.data.status,
      notes: parsed.data.notes || null,
    };

    // Update quantity if provided
    if (parsed.data.quantity !== undefined) {
      updateData.quantity = parsed.data.quantity;
    }

    // Update recommended action if provided (admin/manager only)
    const recommendedAction = formData.get("recommendedAction") as string | null;
    if (recommendedAction && (recommendedAction === "APPROVE" || recommendedAction === "PARTIAL" || recommendedAction === "DENY")) {
      updateData.recommendedAction = recommendedAction;
    }

    // Set fulfilled date if status is FULFILLED
    if (parsed.data.status === "FULFILLED") {
      updateData.fulfilledDate = centralToUTC(nowInCentral().toDate());
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
    if (parsed.data.status === "APPROVED" && amount && amount > 0) {
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
