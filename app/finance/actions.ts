"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function getFinancialSummary(startDate?: string, endDate?: string) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };

	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") {
		return { ok: false, error: "Unauthorized" };
	}

	const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
	const end = endDate ? new Date(endDate) : new Date();
	end.setHours(23, 59, 59, 999);

	try {
		const jobs = await prisma.job.findMany({
			where: { createdAt: { gte: start, lte: end } },
			select: { status: true, finalPrice: true, estimatedPrice: true },
		});

		const revenue = jobs.reduce((sum, j) => {
			if (j.finalPrice) return sum + j.finalPrice;
			if (j.status === "COMPLETED" && j.estimatedPrice) return sum + j.estimatedPrice;
			return sum;
		}, 0);

		const timeEntries = await prisma.timeEntry.findMany({
			where: { clockOut: { not: null, gte: start, lte: end } },
			include: { user: { select: { hourlyRate: true } } },
		});

		let laborHours = 0;
		let laborCost = 0;
		for (const te of timeEntries) {
			if (!te.clockOut) continue;
			const hours = (te.clockOut.getTime() - te.clockIn.getTime()) / (1000 * 60 * 60);
			const rate = te.user.hourlyRate || 0;
			laborHours += hours;
			laborCost += hours * rate;
		}

		const expenses = await prisma.jobExpense.findMany({
			where: { expenseDate: { gte: start, lte: end } },
			select: { amount: true, category: true },
		});
		const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
		const expensesByCategory: Record<string, number> = {};
		for (const e of expenses) {
			expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
		}

		const profit = revenue - (laborCost + totalExpenses);

		return {
			ok: true,
			summary: {
				period: { start: start.toISOString(), end: end.toISOString() },
				revenue,
				labor: { hours: laborHours, cost: laborCost },
				expenses: { total: totalExpenses, byCategory: expensesByCategory },
				profit,
			},
		};
	} catch (e) {
		console.error("Finance summary error:", e);
		return { ok: false, error: "Failed to compute summary" };
	}
}

export async function getTopExpenseCategories(limit = 5, startDate?: string, endDate?: string) {
	const session = await getServerSession(authOptions);
	if (!session?.user) return { ok: false, error: "Not authenticated" };
	const role = (session.user as any).role;
	if (role !== "ADMIN" && role !== "MANAGER") return { ok: false, error: "Unauthorized" };

	const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
	const end = endDate ? new Date(endDate) : new Date();
	end.setHours(23, 59, 59, 999);

	const expenses = await prisma.jobExpense.groupBy({
		by: ["category"],
		where: { expenseDate: { gte: start, lte: end } },
		_sum: { amount: true },
		orderBy: { _sum: { amount: "desc" } },
		take: limit,
	});

	return {
		ok: true,
		categories: expenses.map((e) => ({ category: e.category, total: e._sum.amount || 0 })),
	};
}



