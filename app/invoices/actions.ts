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
		include: { payments: true, lines: true, customer: true, job: { select: { title: true } } },
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
		include: { payments: true, lines: true, customer: true, job: { select: { title: true } } },
	});
	if (!invoice) return { ok: false, error: "Not found" };
	return { ok: true, invoice };
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

	const linesJson = (formData.get("lines") as string) || "[]";
	let lines: Array<{ description: string; quantity: number; rate: number; amount: number }> = [];
	try { lines = JSON.parse(linesJson); } catch {}

	const total = lines.reduce((s, l) => s + (l.amount || l.quantity * l.rate), 0);

	const invoice = await prisma.invoice.create({
		data: {
			jobId: jobId || null,
			customerId: customerId || null,
			status: "SENT",
			issueDate: issueDate ? new Date(issueDate) : new Date(),
			dueDate: dueDate ? new Date(dueDate) : null,
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

	const payment = await prisma.payment.create({
		data: {
			invoiceId,
			amount,
			method: method || null,
			notes: notes || null,
			paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
		},
	});

	await prisma.invoice.update({
		where: { id: invoiceId },
		data: { balance: newBalance, status: newStatus },
	});

	return { ok: true, payment, balance: newBalance, status: newStatus };
}



