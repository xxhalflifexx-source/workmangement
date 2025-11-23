"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listInvoices, createInvoice, recordPayment, filterInvoices, getInvoiceStatistics } from "./actions";
import { getAllCustomers } from "../jobs/actions";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

interface Invoice {
	id: string;
	invoiceNumber: string | null;
	issueDate: Date;
	dueDate: Date | null;
	sentDate: Date | null;
	releaseDate: Date | null;
	collectionDate: Date | null;
	creditDate: Date | null;
	customerName: string | null;
	customer: { name: string } | null;
	lines: Array<{ description: string; amount: number }>;
	total: number;
	balance: number;
	status: string;
	payments: Array<{ paymentDate: Date; amount: number }>;
}

export default function InvoicesPage() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [invoices, setInvoices] = useState<Invoice[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [showCreate, setShowCreate] = useState(false);
	const [showPay, setShowPay] = useState<string | null>(null);

	// Filters
	const [filterCustomer, setFilterCustomer] = useState("");
	const [filterMonth, setFilterMonth] = useState("");
	const [filterYear, setFilterYear] = useState("");
	const [filterStatus, setFilterStatus] = useState("");

	// Statistics
	const [stats, setStats] = useState({ activeInvoices: 0, completedPayments: 0, outstandingInvoices: 0 });
	const [chartData, setChartData] = useState<any[]>([]);
	const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});

	// Create form state
	const [jobId, setJobId] = useState("");
	const [customerId, setCustomerId] = useState("");
	const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
	const [dueDate, setDueDate] = useState("");
	const [notes, setNotes] = useState("");
	const [lines, setLines] = useState<Array<{ description: string; quantity: number; rate: number; amount: number }>>([
		{ description: "", quantity: 1, rate: 0, amount: 0 },
	]);

	const loadCustomers = async () => {
		const res = await getAllCustomers();
		if (res.ok) setCustomers(res.customers || []);
	};

	const loadInvoices = async () => {
		setLoading(true);
		setError(undefined);
		
		if (filterCustomer || filterMonth || filterYear || filterStatus) {
			const res = await filterInvoices({
				customerId: filterCustomer || undefined,
				month: filterMonth || undefined,
				year: filterYear || undefined,
				status: filterStatus || undefined,
			});
			if (!res.ok) setError(res.error);
			if (res.ok) setInvoices(res.invoices as Invoice[]);
		} else {
			const res = await listInvoices();
			if (!res.ok) setError(res.error);
			if (res.ok) setInvoices(res.invoices as Invoice[]);
		}
		setLoading(false);
	};

	const loadStatistics = async () => {
		const res = await getInvoiceStatistics(dateRange.start, dateRange.end);
		if (res.ok && res.stats) {
			setStats(res.stats);
			setChartData(res.chartData || []);
		}
	};

	useEffect(() => {
		loadCustomers();
	}, []);

	useEffect(() => {
		loadInvoices();
	}, [filterCustomer, filterMonth, filterYear, filterStatus]);

	useEffect(() => {
		loadStatistics();
	}, [dateRange]);

	const totalForLines = () => lines.reduce((s, l) => s + (l.amount || l.quantity * l.rate), 0);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		const fd = new FormData();
		if (jobId) fd.append("jobId", jobId);
		if (customerId) fd.append("customerId", customerId);
		fd.append("issueDate", issueDate);
		if (dueDate) fd.append("dueDate", dueDate);
		if (notes) fd.append("notes", notes);
		fd.append("lines", JSON.stringify(lines));
		fd.append("sentDate", new Date().toISOString().split("T")[0]);
		const res = await createInvoice(fd);
		if (!res.ok) { setError(res.error); return; }
		setShowCreate(false);
		setLines([{ description: "", quantity: 1, rate: 0, amount: 0 }]);
		loadInvoices();
		loadStatistics();
	};

	const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const res = await recordPayment(fd);
		if (!res.ok) { setError(res.error); return; }
		setShowPay(null);
		loadInvoices();
		loadStatistics();
	};

	const formatDate = (date: Date | null | undefined) => {
		if (!date) return "--";
		return new Date(date).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
	};

	const calculateElapsed = (invoice: Invoice) => {
		if (!invoice.collectionDate || !invoice.issueDate) return "--";
		const days = Math.floor((new Date(invoice.collectionDate).getTime() - new Date(invoice.issueDate).getTime()) / (1000 * 60 * 60 * 24));
		return days.toString();
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "PAID": return "bg-green-100 text-green-700";
			case "OVERDUE": return "bg-red-100 text-red-700";
			case "SENT": return "bg-blue-100 text-blue-700";
			default: return "bg-gray-100 text-gray-700";
		}
	};

	const downloadPDF = async (invoiceId: string) => {
		window.open(`/api/invoices/${invoiceId}/pdf`, "_blank");
	};

	// Generate month options
	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
	const months = Array.from({ length: 12 }, (_, i) => {
		const month = i + 1;
		return { value: `${currentYear}-${month.toString().padStart(2, "0")}`, label: new Date(currentYear, i).toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
	});

	return (
		<main className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-full mx-auto px-3 sm:px-4 lg:px-5 py-4 flex justify-between items-center">
					<div className="flex items-center gap-3">
						<span className="text-2xl">📄</span>
						<div>
							<h1 className="text-2xl font-bold text-gray-900">Invoices Monitoring</h1>
							<p className="text-sm text-gray-500">Track and manage all invoices</p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<button onClick={() => setShowCreate(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">
							+ New Invoice
						</button>
						<Link href="/dashboard" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
							← Back
						</Link>
					</div>
				</div>
			</header>

			<div className="max-w-full mx-auto px-3 sm:px-4 lg:px-5 py-8">
				{error && <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

				{/* Statistics Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					<div className="bg-white rounded-lg shadow p-6 border border-gray-200">
						<div className="text-sm text-gray-600 mb-1">Active Invoices</div>
						<div className="text-2xl font-bold text-gray-900">${stats.activeInvoices.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
						<div className="text-xs text-gray-500 mt-1">Current Period</div>
					</div>
					<div className="bg-white rounded-lg shadow p-6 border border-gray-200">
						<div className="text-sm text-gray-600 mb-1">Completed Payments</div>
						<div className="text-2xl font-bold text-green-600">${stats.completedPayments.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
						<div className="text-xs text-gray-500 mt-1">Current Period</div>
					</div>
					<div className="bg-white rounded-lg shadow p-6 border border-gray-200">
						<div className="text-sm text-gray-600 mb-1">Outstanding Invoices</div>
						<div className="text-2xl font-bold text-orange-600">${stats.outstandingInvoices.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
						<div className="text-xs text-gray-500 mt-1">Current Period</div>
					</div>
				</div>

				{/* Chart Section */}
				<div className="bg-white rounded-lg shadow p-6 border border-gray-200 mb-8">
					<div className="flex justify-between items-center mb-4">
						<h3 className="text-lg font-semibold text-gray-900">Financial Overview</h3>
						<div className="flex gap-2">
							<select
								value={dateRange.start || ""}
								onChange={(e) => setDateRange({ ...dateRange, start: e.target.value || undefined })}
								className="border rounded px-3 py-1 text-sm"
							>
								<option value="">Start Date</option>
								{years.map((year) => (
									<option key={year} value={`${year}-01-01`}>{year}</option>
								))}
							</select>
							<select
								value={dateRange.end || ""}
								onChange={(e) => setDateRange({ ...dateRange, end: e.target.value || undefined })}
								className="border rounded px-3 py-1 text-sm"
							>
								<option value="">End Date</option>
								{years.map((year) => (
									<option key={year} value={`${year}-12-31`}>{year}</option>
								))}
							</select>
						</div>
					</div>
					{chartData.length > 0 ? (
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={chartData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="month" />
								<YAxis />
								<Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
								<Legend />
								<Line type="monotone" dataKey="invoices" stroke="#3b82f6" name="Invoices" />
								<Line type="monotone" dataKey="payments" stroke="#10b981" name="Payments" />
								<Line type="monotone" dataKey="outstanding" stroke="#f59e0b" name="Outstanding" />
							</LineChart>
						</ResponsiveContainer>
					) : (
						<div className="text-center py-12 text-gray-500">No data available for the selected period</div>
					)}
				</div>

				{/* Filters */}
				<div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div>
							<label className="block text-xs text-gray-600 mb-1">Filter by Customer</label>
							<select
								value={filterCustomer}
								onChange={(e) => setFilterCustomer(e.target.value)}
								className="w-full border rounded px-3 py-2 text-sm"
							>
								<option value="">All Customers</option>
								{customers.map((cust) => (
									<option key={cust.id} value={cust.id}>{cust.name}</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-xs text-gray-600 mb-1">Filter by Month</label>
							<select
								value={filterMonth}
								onChange={(e) => setFilterMonth(e.target.value)}
								className="w-full border rounded px-3 py-2 text-sm"
							>
								<option value="">All Months</option>
								{months.map((m) => (
									<option key={m.value} value={m.value}>{m.label}</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-xs text-gray-600 mb-1">Filter by Year</label>
							<select
								value={filterYear}
								onChange={(e) => setFilterYear(e.target.value)}
								className="w-full border rounded px-3 py-2 text-sm"
							>
								<option value="">All Years</option>
								{years.map((year) => (
									<option key={year} value={year.toString()}>{year}</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-xs text-gray-600 mb-1">Filter by Status</label>
							<select
								value={filterStatus}
								onChange={(e) => setFilterStatus(e.target.value)}
								className="w-full border rounded px-3 py-2 text-sm"
							>
								<option value="">All Statuses</option>
								<option value="DRAFT">Draft</option>
								<option value="SENT">Sent</option>
								<option value="PAID">Paid</option>
								<option value="OVERDUE">Overdue</option>
								<option value="VOID">Void</option>
							</select>
						</div>
					</div>
				</div>

				{/* Invoices Table */}
				{loading ? (
					<div className="text-center py-12 text-gray-600">Loading invoices...</div>
				) : invoices.length === 0 ? (
					<div className="bg-white rounded-xl shadow p-12 text-center">
						<div className="text-6xl mb-4">📄</div>
						<h3 className="text-xl font-semibold text-gray-900 mb-2">No invoices found</h3>
						<p className="text-gray-600">Create your first invoice to get started.</p>
					</div>
				) : (
					<div className="bg-white rounded-xl shadow overflow-x-auto border border-gray-200">
						<table className="min-w-full">
							<thead className="bg-gray-50 text-xs">
								<tr>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">#</th>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">Invoice #</th>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">Client Name</th>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">Description</th>
									<th className="px-4 py-3 text-right border-b font-semibold text-gray-700">Amount</th>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">Invoice Date</th>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">Collection Date</th>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">Elapsed</th>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">Due Date</th>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">Sent Date</th>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">Release Date</th>
									<th className="px-4 py-3 text-left border-b font-semibold text-gray-700">Credit</th>
									<th className="px-4 py-3 text-center border-b font-semibold text-gray-700">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200">
								{invoices.map((inv, idx) => {
									const description = inv.lines[0]?.description || "N/A";
									const shortDesc = description.length > 20 ? description.substring(0, 17) + "..." : description;
									return (
										<tr key={inv.id} className="hover:bg-gray-50 text-sm">
											<td className="px-4 py-3 border-b">{idx + 1}</td>
											<td className="px-4 py-3 border-b font-medium">{inv.invoiceNumber || inv.id.slice(0, 8).toUpperCase()}</td>
											<td className="px-4 py-3 border-b">{inv.customerName || inv.customer?.name || "--"}</td>
											<td className="px-4 py-3 border-b" title={description}>{shortDesc}</td>
											<td className="px-4 py-3 border-b text-right font-medium">${inv.total.toFixed(2)}</td>
											<td className="px-4 py-3 border-b">
												<div className="flex items-center gap-2">
													<span className={`w-2 h-2 rounded-full ${getStatusColor(inv.status).includes("green") ? "bg-green-500" : getStatusColor(inv.status).includes("red") ? "bg-red-500" : "bg-blue-500"}`}></span>
													{formatDate(inv.issueDate)}
												</div>
											</td>
											<td className="px-4 py-3 border-b">{formatDate(inv.collectionDate)}</td>
											<td className="px-4 py-3 border-b">{calculateElapsed(inv)}</td>
											<td className="px-4 py-3 border-b">{formatDate(inv.dueDate)}</td>
											<td className="px-4 py-3 border-b">{formatDate(inv.sentDate)}</td>
											<td className="px-4 py-3 border-b">{formatDate(inv.releaseDate)}</td>
											<td className="px-4 py-3 border-b">{formatDate(inv.creditDate)}</td>
											<td className="px-4 py-3 border-b text-center">
												<div className="flex items-center justify-center gap-2">
													<button
														onClick={() => downloadPDF(inv.id)}
														className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
														title="Download PDF"
													>
														PDF
													</button>
													{inv.balance > 0 && (
														<button
															onClick={() => setShowPay(inv.id)}
															className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
															title="Record Payment"
														>
															Pay
														</button>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Create Invoice Modal */}
			{showCreate && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-xl font-bold text-gray-900">New Invoice</h3>
							<button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700">✕</button>
						</div>
						<form onSubmit={handleCreate} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<input placeholder="Job ID (optional)" value={jobId} onChange={(e) => setJobId(e.target.value)} className="border rounded px-3 py-2" />
								<select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="border rounded px-3 py-2">
									<option value="">Select Customer</option>
									{customers.map((cust) => (
										<option key={cust.id} value={cust.id}>{cust.name}</option>
									))}
								</select>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs text-gray-600 mb-1">Issue Date</label>
									<input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="border rounded px-3 py-2 w-full" />
								</div>
								<div>
									<label className="block text-xs text-gray-600 mb-1">Due Date</label>
									<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border rounded px-3 py-2 w-full" />
								</div>
							</div>
							<div>
								<textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="border rounded px-3 py-2 w-full" rows={2} />
							</div>
							<div>
								<h4 className="font-semibold mb-2">Line Items</h4>
								<div className="space-y-2">
									{lines.map((ln, i) => (
										<div key={i} className="grid grid-cols-6 gap-2">
											<input placeholder="Description" value={ln.description} onChange={(e) => {
												const c = [...lines]; c[i].description = e.target.value; setLines(c);
											}} className="col-span-3 border rounded px-2 py-1" />
											<input type="number" step="0.01" placeholder="Qty" value={ln.quantity} onChange={(e) => {
												const c = [...lines]; c[i].quantity = parseFloat(e.target.value) || 0; c[i].amount = c[i].quantity * c[i].rate; setLines(c);
											}} className="border rounded px-2 py-1" />
											<input type="number" step="0.01" placeholder="Rate" value={ln.rate} onChange={(e) => {
												const c = [...lines]; c[i].rate = parseFloat(e.target.value) || 0; c[i].amount = c[i].quantity * c[i].rate; setLines(c);
											}} className="border rounded px-2 py-1" />
											<div className="text-right flex items-center justify-end font-medium">${(ln.amount || (ln.quantity * ln.rate)).toFixed(2)}</div>
											<button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-red-600 text-sm">✕</button>
										</div>
									))}
									<button type="button" onClick={() => setLines([...lines, { description: "", quantity: 1, rate: 0, amount: 0 }])} className="mt-2 px-3 py-1.5 border rounded text-sm">+ Add Line</button>
								</div>
							</div>
							<div className="flex justify-between items-center pt-2">
								<div className="text-sm text-gray-600">Total</div>
								<div className="text-xl font-bold">${totalForLines().toFixed(2)}</div>
							</div>
							<div className="flex justify-end gap-2 pt-2">
								<button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
								<button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg">Create Invoice</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Record Payment Modal */}
			{showPay && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-xl font-bold text-gray-900">Record Payment</h3>
							<button onClick={() => setShowPay(null)} className="text-gray-500 hover:text-gray-700">✕</button>
						</div>
						<form onSubmit={handleRecordPayment} className="space-y-4">
							<input type="hidden" name="invoiceId" value={showPay} />
							<div>
								<label className="block text-xs text-gray-600 mb-1">Amount</label>
								<input name="amount" type="number" step="0.01" min="0.01" required className="border rounded px-3 py-2 w-full" />
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs text-gray-600 mb-1">Method</label>
									<input name="method" placeholder="Cash, Card, ACH" className="border rounded px-3 py-2 w-full" />
								</div>
								<div>
									<label className="block text-xs text-gray-600 mb-1">Date</label>
									<input name="paymentDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="border rounded px-3 py-2 w-full" />
								</div>
							</div>
							<div>
								<label className="block text-xs text-gray-600 mb-1">Notes</label>
								<textarea name="notes" className="border rounded px-3 py-2 w-full" rows={2} />
							</div>
							<div className="flex justify-end gap-2">
								<button type="button" onClick={() => setShowPay(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
								<button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg">Record</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</main>
	);
}
