"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { nowInCentral, parseCentralDate } from "@/lib/date-utils";

export async function getFinancialSummary(startDate?: string, endDate?: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Allow managers and admins to view financials
  if (userRole !== "ADMIN" && userRole !== "MANAGER") {
    return { ok: false, error: "Unauthorized: Only managers and admins can view financials" };
  }

  // Date range
  const start = startDate ? parseCentralDate(startDate) : nowInCentral().startOf('year').toDate();
  const end = endDate ? parseCentralDate(endDate) : nowInCentral().endOf('day').toDate();

  try {
    // Revenue = sum of job.finalPrice within range OR estimatedPrice when final missing and job completed
    const jobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        status: true,
        finalPrice: true,
        estimatedPrice: true,
      },
    });

    const revenue = jobs.reduce(
      (sum: number, j: { status: string; finalPrice: number | null; estimatedPrice: number | null }) => {
      if (j.finalPrice) return sum + j.finalPrice;
      if (j.status === "COMPLETED" && j.estimatedPrice) return sum + j.estimatedPrice;
      return sum;
    }, 0);

    // Labor costs from time entries (clockOut within range) * user.hourlyRate
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        clockOut: { not: null, gte: start, lte: end },
      },
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

    // Expenses from JobExpense within range
    const expenses = await prisma.jobExpense.findMany({
      where: { expenseDate: { gte: start, lte: end } },
      select: { amount: true, category: true },
    });

    const totalExpenses = expenses.reduce(
      (sum: number, e: { amount: number; category: string }) => sum + e.amount,
      0
    );
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
        bankroll: profit, // baseline bankroll; could be extended with opening balance later
      },
    };
  } catch (error) {
    console.error("Financial summary error:", error);
    return { ok: false, error: "Failed to compute financial summary" };
  }
}

