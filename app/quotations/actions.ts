"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { nowInCentral, centralToUTC, parseCentralDate } from "@/lib/date-utils";

export async function getQuotationsByJobId(jobId: string) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	try {
		const quotations = await prisma.quotation.findMany({
			where: { jobId },
			include: {
				lines: true,
				job: { select: { title: true, id: true } },
				customer: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return { ok: true, quotations };
	} catch (error: any) {
		console.error("Get quotations by job error:", error);
		return { ok: false, error: error?.message || "Failed to load quotations" };
	}
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

	const quotation = await prisma.quotation.create({
		data: {
			quotationNumber: null, // No quotation numbers
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

