"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { sendJobStatusEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type QCStatus = "PASS" | "FAIL" | "MINOR_ISSUES";

function getQcScore(status: QCStatus): number {
  switch (status) {
    case "PASS":
      return 1.0;
    case "MINOR_ISSUES":
      return 0.5;
    case "FAIL":
    default:
      return 0.0;
  }
}

export async function getJobsAwaitingQC() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated", jobs: [] as any[] };
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return { ok: false, error: "Unauthorized", jobs: [] as any[] };
  }

  const jobs = await prisma.job.findMany({
    where: {
      status: {
        in: ["AWAITING_QC", "REWORK"],
      },
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      customer: { select: { name: true } },
      timeEntries: {
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { clockIn: "asc" },
      },
      qcRecords: {
        orderBy: { createdAt: "desc" },
      },
      reworkEntries: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return { ok: true, jobs };
}

/**
 * Submit a QC review (PASS / FAIL / MINOR_ISSUES) for a job.
 * Creates a QCRecord, optionally a ReworkEntry, updates job status,
 * and sends notifications to relevant users.
 */
export async function submitQCReview(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const role = (session.user as any).role;
  const qcUserId = (session.user as any).id as string;

  if (role !== "ADMIN" && role !== "MANAGER") {
    return { ok: false, error: "Unauthorized" };
  }

  const jobId = formData.get("jobId") as string;
  const qcStatusRaw = (formData.get("qcStatus") as string)?.toUpperCase() as QCStatus;
  const notes = (formData.get("notes") as string) || "";
  const responsibleUserIds = (formData.getAll("responsibleUserIds") as string[]).filter(
    (id) => !!id
  );

  if (!jobId) {
    return { ok: false, error: "Job ID is required" };
  }

  if (!["PASS", "FAIL", "MINOR_ISSUES"].includes(qcStatusRaw)) {
    return { ok: false, error: "Invalid QC status" };
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } },
    },
  });

  if (!job) {
    return { ok: false, error: "Job not found" };
  }

  const qcScore = getQcScore(qcStatusRaw);

  // Create QCRecord
  await prisma.qCRecord.create({
    data: {
      jobId,
      qcUserId,
      qcStatus: qcStatusRaw,
      qcScore,
      notes: notes || null,
      photos: null,
    },
  });

  let newStatus: string = job.status;

  if (qcStatusRaw === "FAIL") {
    newStatus = "REWORK";
  } else {
    newStatus = "COMPLETED";
  }

  const updatedJob = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: newStatus,
    },
  });

  // If QC failed, create one ReworkEntry per responsible worker
  if (qcStatusRaw === "FAIL") {
    const targetIds =
      responsibleUserIds.length > 0
        ? responsibleUserIds
        : job.assignedTo
        ? [job.assignedTo]
        : [];

    if (targetIds.length === 0) {
      // Still record at least one entry with no specific responsible worker
      await prisma.reworkEntry.create({
        data: {
          jobId,
          responsibleUserId: null,
          createdByUserId: qcUserId,
          reason: notes || "Job failed QC",
        },
      });
    } else {
      await Promise.all(
        targetIds.map((responsibleId) =>
          prisma.reworkEntry.create({
            data: {
              jobId,
              responsibleUserId: responsibleId,
              createdByUserId: qcUserId,
              reason: notes || "Job failed QC",
            },
          })
        )
      );
    }
  }

  // Email notifications (deduplicated so users don't get duplicates)
  const rawRecipients = [job.assignee?.email, job.creator?.email];
  const recipients = Array.from(
    new Set(rawRecipients.filter((e): e is string => !!e))
  );

  const messageLines = [
    `QC Result: ${qcStatusRaw}`,
    `New Status: ${newStatus}`,
  ];

  if (notes) {
    messageLines.push("", "Notes:", notes);
  }

  const message = messageLines.join("\n");

  await Promise.all(
    recipients.map((email) =>
      sendJobStatusEmail(email, job.title, newStatus, message)
    )
  );

  // Revalidate key pages
  revalidatePath("/qc");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");

  return { ok: true, job: updatedJob };
}

/**
 * Thin wrapper suitable for Next.js <form action={...}> usage.
 * Ignores the return value from submitQCReview and just performs the mutation.
 */
export async function submitQCReviewAction(formData: FormData): Promise<void> {
  await submitQCReview(formData);
  // Redirect back with a small flag so the QC page can show a success message
  redirect("/qc?qc=ok");
}


