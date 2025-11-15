"use client";

import { useEffect, useState } from "react";
import { getFinancialSummary, getTopExpenseCategories } from "./actions";
import Link from "next/link";

export default function FinancePage() {
	const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
	const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [summary, setSummary] = useState<any>();
	const [topExpenses, setTopExpenses] = useState<{ category: string; total: number }[]>([]);

	const load = async () => {
		setLoading(true);
		setError(undefined);
		const [s, cats] = await Promise.all([
			getFinancialSummary(startDate, endDate),
			getTopExpenseCategories(5, startDate, endDate),
		]);
		if (!s.ok) setError(s.error);
		if (s.ok) setSummary(s.summary);
		if (cats.ok) setTopExpenses(cats.categories);
		setLoading(false);
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<main className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
					<div>
						<h1 className="text-2xl font-bold text-gray-900">Company Financials</h1>
						<p className="text-sm text-gray-500">Revenue, costs, and profit</p>
					</div>
					<Link href="/dashboard" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
						← Back to Dashboard
					</Link>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Filters */}
				<div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
					<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
						<div>
							<label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
							<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm" />
						</div>
						<div>
							<label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
							<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm" />
						</div>
						<button onClick={load} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Apply</button>
					</div>
				</div>

				{error && (
					<div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
				)}

				{loading ? (
					<div className="text-center py-12 text-gray-600">Loading summary...</div>
				) : summary ? (
					<>
						{/* KPI Cards */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
							<div className="bg-white rounded-xl shadow p-6 border border-gray-200">
								<p className="text-xs uppercase text-gray-500 mb-2">Revenue</p>
								<p className="text-2xl font-bold text-gray-900">${summary.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
							</div>
							<div className="bg-white rounded-xl shadow p-6 border border-gray-200">
								<p className="text-xs uppercase text-gray-500 mb-2">Labor Cost</p>
								<p className="text-2xl font-bold text-gray-900">${summary.labor.cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
								<p className="text-xs text-gray-500 mt-1">{summary.labor.hours.toFixed(2)} hrs</p>
							</div>
							<div className="bg-white rounded-xl shadow p-6 border border-gray-200">
								<p className="text-xs uppercase text-gray-500 mb-2">Expenses</p>
								<p className="text-2xl font-bold text-gray-900">${summary.expenses.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
							</div>
							<div className="bg-white rounded-xl shadow p-6 border border-gray-200">
								<p className="text-xs uppercase text-gray-500 mb-2">Profit</p>
								<p className={`text-2xl font-bold ${summary.profit >= 0 ? "text-green-700" : "text-red-700"}`}>${summary.profit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
							</div>
						</div>

						{/* Expenses by Category */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<div className="bg-white rounded-xl shadow p-6 border border-gray-200">
								<h3 className="text-lg font-semibold text-gray-900 mb-4">Top Expense Categories</h3>
								{topExpenses.length === 0 ? (
									<p className="text-gray-600 text-sm">No expenses in this period.</p>
								) : (
									<div className="space-y-3">
										{topExpenses.map((e) => (
											<div key={e.category} className="flex justify-between text-sm">
												<span className="text-gray-700">{e.category}</span>
												<span className="font-medium text-gray-900">${e.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
											</div>
										))}
									</div>
								)}
							</div>

							<div className="bg-white rounded-xl shadow p-6 border border-gray-200">
								<h3 className="text-lg font-semibold text-gray-900 mb-4">Reporting Period</h3>
								<p className="text-sm text-gray-600">
									{new Date(summary.period.start).toLocaleDateString()} – {new Date(summary.period.end).toLocaleDateString()}
								</p>
							</div>
						</div>
					</>
				) : (
					<div className="text-center py-12 text-gray-600">No data available.</div>
				)}
			</div>
		</main>
	);
}



