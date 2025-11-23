"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function listInvoices() {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const invoices = await prisma.invoice.findMany({
		include: { payments: true, lines: true, customer: true, job: { select: { title: true, id: true } } },
		orderBy: { createdAt: "desc" },
	});
	return { ok: true, invoices };
}

export async function getInvoice(id: string) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const invoice = await prisma.invoice.findUnique({
		where: { id },
		include: { payments: true, lines: true, customer: true, job: { select: { title: true, id: true } } },
	});
	if (!invoice) return { ok: false, error: "Not found" };
	return { ok: true, invoice };
}

// Helper function to generate next invoice number
async function getNextInvoiceNumber(): Promise<string> {
	const currentYear = 2025;
	
	// Find all invoices with invoice numbers matching INV-2025-#### pattern
	const invoices2025 = await prisma.invoice.findMany({
		where: {
			invoiceNumber: {
				startsWith: `INV-${currentYear}-`,
			},
		},
		select: {
			invoiceNumber: true,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	let nextSequence = 1; // Start at 0001

	if (invoices2025.length > 0) {
		// Extract sequence numbers from all 2025 invoices
		const sequences = invoices2025
			.map((inv) => {
				// Match pattern INV-2025-#### and extract the 4-digit sequence
				const match = inv.invoiceNumber?.match(/INV-2025-(\d{4})$/);
				return match ? parseInt(match[1], 10) : 0;
			})
			.filter((seq) => seq > 0);

		if (sequences.length > 0) {
			// Find the highest sequence number and increment
			const maxSequence = Math.max(...sequences);
			nextSequence = maxSequence + 1;
		}
	}

	// Format as INV-2025-#### with 4-digit sequence padded with zeros
	return `INV-${currentYear}-${nextSequence.toString().padStart(4, "0")}`;
}

export async function createInvoice(formData: FormData) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const jobId = (formData.get("jobId") as string) || undefined;
	const customerId = (formData.get("customerId") as string) || undefined;
	const issueDate = formData.get("issueDate") as string;
	const dueDate = (formData.get("dueDate") as string) || "";
	const notes = (formData.get("notes") as string) || "";
	const sentDate = (formData.get("sentDate") as string) || "";

	const linesJson = (formData.get("lines") as string) || "[]";
	let lines: Array<{ description: string; quantity: number; rate: number; amount: number }> = [];
	try { lines = JSON.parse(linesJson); } catch {}

	const total = lines.reduce((s, l) => s + (l.amount || l.quantity * l.rate), 0);

	// Generate invoice number
	const invoiceNumber = await getNextInvoiceNumber();

	const invoice = await prisma.invoice.create({
		data: {
			invoiceNumber,
			jobId: jobId || null,
			customerId: customerId || null,
			status: "SENT",
			issueDate: issueDate ? new Date(issueDate) : new Date(),
			dueDate: dueDate ? new Date(dueDate) : null,
			sentDate: sentDate ? new Date(sentDate) : new Date(), // Auto-set sent date when creating
			notes: notes || null,
			total,
			balance: total,
			lines: {
				create: lines.map((l) => ({
					description: l.description,
					quantity: l.quantity,
					rate: l.rate,
					amount: l.amount || l.quantity * l.rate,
				})),
			},
		},
		include: { lines: true },
	});

	return { ok: true, invoice };
}

export async function recordPayment(formData: FormData) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const invoiceId = formData.get("invoiceId") as string;
	const amount = parseFloat(formData.get("amount") as string);
	const method = (formData.get("method") as string) || "";
	const notes = (formData.get("notes") as string) || "";
	const paymentDate = (formData.get("paymentDate") as string) || "";

	if (!invoiceId || isNaN(amount) || amount <= 0) return { ok: false, error: "Invalid input" };

	const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
	if (!invoice) return { ok: false, error: "Invoice not found" };

	const newBalance = Math.max(0, (invoice.balance || 0) - amount);
	const newStatus = newBalance === 0 ? "PAID" : invoice.status;
	const paymentDateObj = paymentDate ? new Date(paymentDate) : new Date();

	const payment = await prisma.payment.create({
		data: {
			invoiceId,
			amount,
			method: method || null,
			notes: notes || null,
			paymentDate: paymentDateObj,
		},
	});

	// Update invoice with collection date when fully paid
	const updateData: any = { balance: newBalance, status: newStatus };
	if (newBalance === 0 && !invoice.collectionDate) {
		updateData.collectionDate = paymentDateObj;
	}

	await prisma.invoice.update({
		where: { id: invoiceId },
		data: updateData,
	});

	return { ok: true, payment, balance: newBalance, status: newStatus };
}

// Get invoice statistics for charts
export async function getInvoiceStatistics(startDate?: string, endDate?: string) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const where: any = {};
	if (startDate || endDate) {
		where.issueDate = {};
		if (startDate) where.issueDate.gte = new Date(startDate);
		if (endDate) where.issueDate.lte = new Date(endDate);
	}

	const invoices = await prisma.invoice.findMany({
		where,
		include: { payments: true },
	});

	// Calculate statistics
	const activeInvoices = invoices.filter((inv) => inv.status !== "PAID" && inv.status !== "VOID");
	const completedPayments = invoices.filter((inv) => inv.status === "PAID");
	const outstandingInvoices = invoices.filter((inv) => inv.balance > 0);

	const activeInvoicesTotal = activeInvoices.reduce((sum, inv) => sum + inv.total, 0);
	const completedPaymentsTotal = completedPayments.reduce((sum, inv) => sum + inv.total, 0);
	const outstandingInvoicesTotal = outstandingInvoices.reduce((sum, inv) => sum + inv.balance, 0);

	// Group by month for chart data
	const monthlyData: Record<string, { invoices: number; payments: number; outstanding: number }> = {};

	invoices.forEach((inv) => {
		const monthKey = inv.issueDate.toISOString().slice(0, 7); // YYYY-MM
		if (!monthlyData[monthKey]) {
			monthlyData[monthKey] = { invoices: 0, payments: 0, outstanding: 0 };
		}
		monthlyData[monthKey].invoices += inv.total;
		if (inv.status === "PAID") {
			monthlyData[monthKey].payments += inv.total;
		}
		monthlyData[monthKey].outstanding += inv.balance;
	});

	const chartData = Object.entries(monthlyData)
		.map(([month, data]) => ({
			month,
			invoices: data.invoices,
			payments: data.payments,
			outstanding: data.outstanding,
		}))
		.sort((a, b) => a.month.localeCompare(b.month));

	return {
		ok: true,
		stats: {
			activeInvoices: activeInvoicesTotal,
			completedPayments: completedPaymentsTotal,
			outstandingInvoices: outstandingInvoicesTotal,
		},
		chartData,
	};
}

// Filter invoices
export async function filterInvoices(filters: {
	customerId?: string;
	month?: string;
	year?: string;
	status?: string;
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

	const invoices = await prisma.invoice.findMany({
		where,
		include: { payments: true, lines: true, customer: true, job: { select: { title: true, id: true } } },
		orderBy: { issueDate: "desc" },
	});

	return { ok: true, invoices };
}

// Update invoice PDF files
export async function updateInvoicePDFs(invoiceId: string, pdfFiles: string[]) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	try {
		const invoice = await prisma.invoice.update({
			where: { id: invoiceId },
			data: {
				pdfFiles: JSON.stringify(pdfFiles),
			},
		});

		return { ok: true, invoice };
	} catch (error: any) {
		console.error("Update invoice PDFs error:", error);
		return { ok: false, error: error?.message || "Failed to update invoice PDFs" };
	}
}



