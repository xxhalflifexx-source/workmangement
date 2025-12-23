"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { nowInCentral, centralToUTC, parseCentralDate } from "@/lib/date-utils";

// Helper function to generate next quotation number
export async function getNextQuotationNumber(): Promise<string> {
	const { nowInCentral } = await import("@/lib/date-utils");
	const currentYear = nowInCentral().year();
	
	// Find all quotations with quotation numbers matching QUO-YYYY-#### pattern for current year
	const quotationsForYear = await prisma.quotation.findMany({
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

	if (quotationsForYear.length > 0) {
		const sequences = quotationsForYear
			.map((q) => {
				const match = q.quotationNumber?.match(new RegExp(`QUO-${currentYear}-(\\d{4})$`));
				return match ? parseInt(match[1], 10) : 0;
			})
			.filter((seq) => seq > 0);

		if (sequences.length > 0) {
			const maxSequence = Math.max(...sequences);
			nextSequence = maxSequence + 1;
		}
	}

	return `QUO-${currentYear}-${nextSequence.toString().padStart(4, "0")}`;
}

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
				job: { select: { title: true, id: true, jobNumber: true } },
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

	try {
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
		try { 
			lines = JSON.parse(linesJson); 
		} catch (parseError) {
			console.error("Error parsing lines JSON:", parseError);
			return { ok: false, error: "Invalid line items format" };
		}

		// Filter out empty line items
		const validLines = lines
			.filter((l) => l.description && l.description.trim() !== "")
			.map((l) => ({
				description: (l.description || "").trim() || "Item",
				quantity: l.quantity || 0,
				rate: l.rate || 0,
				amount: l.amount || (l.quantity || 0) * (l.rate || 0),
			}));

		const total = validLines.reduce((s, l) => s + (l.amount || 0), 0) + shippingFee;

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
					create: validLines,
				},
			},
			include: { lines: true, job: { select: { title: true, id: true, jobNumber: true } }, customer: true },
		});

		return { ok: true, quotation };
	} catch (error: any) {
		console.error("Create quotation error:", error);
		return { ok: false, error: error?.message || "Failed to create quotation" };
	}
}

export async function updateQuotation(formData: FormData) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	try {
		const quotationId = formData.get("quotationId") as string;
		if (!quotationId) return { ok: false, error: "Quotation ID is required" };

		const customerName = (formData.get("customerName") as string) || "";
		const customerAddress = (formData.get("customerAddress") as string) || "";
		const customerPhone = (formData.get("customerPhone") as string) || "";
		const customerEmail = (formData.get("customerEmail") as string) || "";
		const issueDate = formData.get("issueDate") as string;
		const validUntil = (formData.get("validUntil") as string) || "";
		const notes = (formData.get("notes") as string) || "";
		const status = (formData.get("status") as string) || "";
		const shippingFee = parseFloat((formData.get("shippingFee") as string) || "0");
		const paymentBank = (formData.get("paymentBank") as string) || "";
		const paymentAccountName = (formData.get("paymentAccountName") as string) || "";
		const paymentAccountNumber = (formData.get("paymentAccountNumber") as string) || "";
		const preparedByName = (formData.get("preparedByName") as string) || "";
		const preparedByTitle = (formData.get("preparedByTitle") as string) || "";

		const linesJson = (formData.get("lines") as string) || "[]";
		let lines: Array<{ description: string; quantity: number; rate: number; amount: number }> = [];
		try { 
			lines = JSON.parse(linesJson); 
		} catch (parseError) {
			console.error("Error parsing lines JSON:", parseError);
			return { ok: false, error: "Invalid line items format" };
		}

		const validLines = lines
			.filter((l) => l.description && l.description.trim() !== "")
			.map((l) => ({
				description: (l.description || "").trim() || "Item",
				quantity: l.quantity || 0,
				rate: l.rate || 0,
				amount: l.amount || (l.quantity || 0) * (l.rate || 0),
			}));

		const total = validLines.reduce((s, l) => s + (l.amount || 0), 0) + shippingFee;

		// Delete existing lines and create new ones
		await prisma.quotationLine.deleteMany({
			where: { quotationId },
		});

		const updateData: any = {
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
				create: validLines,
			},
		};

		if (status) {
			updateData.status = status;
		}

		const quotation = await prisma.quotation.update({
			where: { id: quotationId },
			data: updateData,
			include: { lines: true, job: { select: { title: true, id: true, jobNumber: true } }, customer: true },
		});

		return { ok: true, quotation };
	} catch (error: any) {
		console.error("Update quotation error:", error);
		return { ok: false, error: error?.message || "Failed to update quotation" };
	}
}

export async function getQuotation(id: string) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const quotation = await prisma.quotation.findUnique({
		where: { id },
		include: { lines: true, job: { select: { title: true, id: true, jobNumber: true } }, customer: true },
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
				job: { select: { title: true, id: true, jobNumber: true } },
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

// Filter quotations
export async function filterQuotations(filters: {
	customerId?: string;
	status?: string;
	month?: string;
	year?: string;
}) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const where: any = {};

	if (filters.customerId) {
		where.customerId = filters.customerId;
	}

	if (filters.status) {
		where.status = filters.status;
	}

	if (filters.month || filters.year) {
		where.issueDate = {};
		if (filters.year) {
			const year = parseInt(filters.year);
			const startDate = new Date(year, 0, 1);
			const endDate = new Date(year, 11, 31, 23, 59, 59);
			where.issueDate.gte = startDate;
			where.issueDate.lte = endDate;
		}
		if (filters.month) {
			const [year, month] = filters.month.split("-").map(Number);
			const startDate = new Date(year, month - 1, 1);
			const endDate = new Date(year, month, 0, 23, 59, 59);
			where.issueDate.gte = startDate;
			where.issueDate.lte = endDate;
		}
	}

	const quotations = await prisma.quotation.findMany({
		where,
		include: { 
			lines: true, 
			job: { select: { title: true, id: true, jobNumber: true } }, 
			customer: true 
		},
		orderBy: { issueDate: "desc" },
	});

	return { ok: true, quotations };
}

// Update quotation status
export async function updateQuotationStatus(quotationId: string, status: string) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const validStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"];
	if (!validStatuses.includes(status)) {
		return { ok: false, error: "Invalid status" };
	}

	const quotation = await prisma.quotation.update({
		where: { id: quotationId },
		data: { status },
	});

	return { ok: true, quotation };
}

// Convert quotation to invoice
export async function convertQuotationToInvoice(quotationId: string) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	try {
		// Get the quotation with all details
		const quotation = await prisma.quotation.findUnique({
			where: { id: quotationId },
			include: { lines: true, customer: true, job: true },
		});

		if (!quotation) {
			return { ok: false, error: "Quotation not found" };
		}

		if (quotation.status === "CONVERTED") {
			return { ok: false, error: "This quotation has already been converted to an invoice" };
		}

		// Check if job already has an invoice
		if (quotation.jobId) {
			const existingInvoice = await prisma.invoice.findFirst({
				where: { 
					jobId: quotation.jobId,
					deletedAt: null,
				},
			});
			if (existingInvoice) {
				return { ok: false, error: "An invoice already exists for this job" };
			}
		}

		// Import invoice number generator
		const { getNextInvoiceNumber } = await import("../invoices/actions");
		const invoiceNumber = await getNextInvoiceNumber();

		// Create invoice from quotation data
		const invoice = await prisma.invoice.create({
			data: {
				invoiceNumber,
				jobId: quotation.jobId,
				customerId: quotation.customerId,
				customerName: quotation.customerName,
				customerEmail: quotation.customerEmail,
				status: "PENDING",
				issueDate: centralToUTC(nowInCentral().toDate()),
				dueDate: null,
				sentDate: centralToUTC(nowInCentral().toDate()),
				notes: quotation.notes,
				total: quotation.total,
				balance: quotation.total,
				lines: {
					create: quotation.lines.map((line) => ({
						description: line.description,
						quantity: line.quantity,
						rate: line.rate,
						amount: line.amount,
					})),
				},
			},
			include: { lines: true },
		});

		// Mark quotation as converted
		await prisma.quotation.update({
			where: { id: quotationId },
			data: { status: "CONVERTED" },
		});

		return { ok: true, invoice, quotation };
	} catch (error: any) {
		console.error("Convert quotation to invoice error:", error);
		return { ok: false, error: error?.message || "Failed to convert quotation to invoice" };
	}
}

// Get jobs for quotation creation
export async function getJobsForQuotation() {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	try {
		const jobs = await prisma.job.findMany({
			include: {
				customer: true,
				assignee: {
					select: {
						name: true,
						email: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return { ok: true, jobs };
	} catch (error: any) {
		console.error("Get jobs for quotation error:", error);
		return { ok: false, error: error?.message || "Failed to load jobs" };
	}
}

// Get all customers for quotation creation
export async function getCustomersForQuotation() {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	try {
		const customers = await prisma.customer.findMany({
			orderBy: { name: "asc" },
		});

		return { ok: true, customers };
	} catch (error: any) {
		console.error("Get customers for quotation error:", error);
		return { ok: false, error: error?.message || "Failed to load customers" };
	}
}
