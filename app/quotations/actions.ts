"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { nowInCentral, centralToUTC, parseCentralDate } from "@/lib/date-utils";

export async function getNextQuotationNumber(): Promise<string> {
	const currentYear = nowInCentral().year();
	
	// Find all quotations with quotation numbers matching QUO-2025-#### pattern
	const quotations2025 = await prisma.quotation.findMany({
		where: {
			quotationNumber: {
				startsWith: `QUO-${currentYear}-`,
			},
		},
		select: {
			quotationNumber: true,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	let nextSequence = 1;

	if (quotations2025.length > 0) {
		// Extract sequence numbers from all 2025 quotations
		const sequences = quotations2025
			.map((quo) => {
				// Match pattern QUO-2025-#### and extract the 4-digit sequence
				const match = quo.quotationNumber?.match(/QUO-(\d{4})-(\d{4})$/);
				return match ? parseInt(match[2], 10) : 0;
			})
			.filter((seq) => seq > 0);

		if (sequences.length > 0) {
			// Find the highest sequence number and increment
			const maxSequence = Math.max(...sequences);
			nextSequence = maxSequence + 1;
		}
	}

	// Format as QUO-2025-#### with 4-digit sequence padded with zeros
	return `QUO-${currentYear}-${nextSequence.toString().padStart(4, "0")}`;
}

export async function createQuotation(formData: FormData) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const jobId = (formData.get("jobId") as string) || undefined;
	const customerId = (formData.get("customerId") as string) || undefined;
	const customerName = (formData.get("customerName") as string) || "";
	const customerAddress = (formData.get("customerAddress") as string) || "";
	const customerPhone = (formData.get("customerPhone") as string) || "";
	const customerEmail = (formData.get("customerEmail") as string) || "";
	const issueDate = formData.get("issueDate") as string;
	const validUntil = (formData.get("validUntil") as string) || "";
	const notes = (formData.get("notes") as string) || "";
	const shippingFee = parseFloat((formData.get("shippingFee") as string) || "0");
	const paymentBank = (formData.get("paymentBank") as string) || "";
	const paymentAccountName = (formData.get("paymentAccountName") as string) || "";
	const paymentAccountNumber = (formData.get("paymentAccountNumber") as string) || "";
	const preparedByName = (formData.get("preparedByName") as string) || "";
	const preparedByTitle = (formData.get("preparedByTitle") as string) || "";

	const linesJson = (formData.get("lines") as string) || "[]";
	let lines: Array<{ description: string; quantity: number; rate: number; amount: number }> = [];
	try { lines = JSON.parse(linesJson); } catch {}

	const total = lines.reduce((s, l) => s + (l.amount || l.quantity * l.rate), 0) + shippingFee;

	// Generate quotation number
	const quotationNumber = await getNextQuotationNumber();

	const quotation = await prisma.quotation.create({
		data: {
			quotationNumber,
			jobId: jobId || null,
			customerId: customerId || null,
			customerName: customerName || null,
			customerAddress: customerAddress || null,
			customerPhone: customerPhone || null,
			customerEmail: customerEmail || null,
			status: "DRAFT",
			issueDate: issueDate ? parseCentralDate(issueDate) : centralToUTC(nowInCentral().toDate()),
			validUntil: validUntil ? parseCentralDate(validUntil) : null,
			notes: notes || null,
			shippingFee,
			total,
			paymentBank: paymentBank || null,
			paymentAccountName: paymentAccountName || null,
			paymentAccountNumber: paymentAccountNumber || null,
			preparedByName: preparedByName || null,
			preparedByTitle: preparedByTitle || null,
			lines: {
				create: lines.map((l) => ({
					description: l.description,
					quantity: l.quantity,
					rate: l.rate,
					amount: l.amount || l.quantity * l.rate,
				})),
			},
		},
		include: { lines: true, job: { select: { title: true, id: true } }, customer: true },
	});

	return { ok: true, quotation };
}

export async function updateQuotation(formData: FormData) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const quotationId = formData.get("quotationId") as string;
	if (!quotationId) return { ok: false, error: "Quotation ID is required" };

	const customerName = (formData.get("customerName") as string) || "";
	const customerAddress = (formData.get("customerAddress") as string) || "";
	const customerPhone = (formData.get("customerPhone") as string) || "";
	const customerEmail = (formData.get("customerEmail") as string) || "";
	const issueDate = formData.get("issueDate") as string;
	const validUntil = (formData.get("validUntil") as string) || "";
	const notes = (formData.get("notes") as string) || "";
	const shippingFee = parseFloat((formData.get("shippingFee") as string) || "0");
	const paymentBank = (formData.get("paymentBank") as string) || "";
	const paymentAccountName = (formData.get("paymentAccountName") as string) || "";
	const paymentAccountNumber = (formData.get("paymentAccountNumber") as string) || "";
	const preparedByName = (formData.get("preparedByName") as string) || "";
	const preparedByTitle = (formData.get("preparedByTitle") as string) || "";

	const linesJson = (formData.get("lines") as string) || "[]";
	let lines: Array<{ description: string; quantity: number; rate: number; amount: number }> = [];
	try { lines = JSON.parse(linesJson); } catch {}

	const total = lines.reduce((s, l) => s + (l.amount || l.quantity * l.rate), 0) + shippingFee;

	// Delete existing lines and create new ones
	await prisma.quotationLine.deleteMany({
		where: { quotationId },
	});

	const quotation = await prisma.quotation.update({
		where: { id: quotationId },
		data: {
			customerName: customerName || null,
			customerAddress: customerAddress || null,
			customerPhone: customerPhone || null,
			customerEmail: customerEmail || null,
			issueDate: issueDate ? parseCentralDate(issueDate) : centralToUTC(nowInCentral().toDate()),
			validUntil: validUntil ? parseCentralDate(validUntil) : null,
			notes: notes || null,
			shippingFee,
			total,
			paymentBank: paymentBank || null,
			paymentAccountName: paymentAccountName || null,
			paymentAccountNumber: paymentAccountNumber || null,
			preparedByName: preparedByName || null,
			preparedByTitle: preparedByTitle || null,
			lines: {
				create: lines.map((l) => ({
					description: l.description,
					quantity: l.quantity,
					rate: l.rate,
					amount: l.amount || l.quantity * l.rate,
				})),
			},
		},
		include: { lines: true, job: { select: { title: true, id: true } }, customer: true },
	});

	return { ok: true, quotation };
}

export async function getQuotation(id: string) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const quotation = await prisma.quotation.findUnique({
		where: { id },
		include: { lines: true, job: { select: { title: true, id: true } }, customer: true },
	});
	if (!quotation) return { ok: false, error: "Not found" };
	return { ok: true, quotation };
}

export async function listQuotations() {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	try {
		const quotations = await prisma.quotation.findMany({
			include: {
				lines: true,
				job: { select: { title: true, id: true } },
				customer: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return { ok: true, quotations };
	} catch (error: any) {
		console.error("List quotations error:", error);
		return { ok: false, error: error?.message || "Failed to load quotations" };
	}
}

export async function deleteQuotation(id: string) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	try {
		await prisma.quotation.delete({
			where: { id },
		});
		return { ok: true };
	} catch (error: any) {
		console.error("Delete quotation error:", error);
		return { ok: false, error: error?.message || "Failed to delete quotation" };
	}
}

