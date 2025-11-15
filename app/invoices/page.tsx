"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listInvoices, createInvoice, recordPayment } from "./actions";

export default function InvoicesPage() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [invoices, setInvoices] = useState<any[]>([]);
	const [showCreate, setShowCreate] = useState(false);
	const [showPay, setShowPay] = useState<string | null>(null);

	// Create form state
	const [jobId, setJobId] = useState("");
	const [customerId, setCustomerId] = useState("");
	const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
	const [dueDate, setDueDate] = useState("");
	const [notes, setNotes] = useState("");
	const [lines, setLines] = useState<Array<{ description: string; quantity: number; rate: number; amount: number }>>([
		{ description: "", quantity: 1, rate: 0, amount: 0 },
	]);

	const load = async () => {
		setLoading(true);
		setError(undefined);
		const res = await listInvoices();
		if (!res.ok) setError(res.error);
		if (res.ok) setInvoices(res.invoices as any);
		setLoading(false);
	};

	useEffect(() => {
		load();
	}, []);

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
		const res = await createInvoice(fd);
		if (!res.ok) { setError(res.error); return; }
		setShowCreate(false);
		setLines([{ description: "", quantity: 1, rate: 0, amount: 0 }]);
		load();
	};

	const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const res = await recordPayment(fd);
		if (!res.ok) { setError(res.error); return; }
		setShowPay(null);
		load();
	};

	return (
		<main className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
					<div>
						<h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
						<p className="text-sm text-gray-500">Create invoices and record payments</p>
					</div>
					<Link href="/dashboard" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">← Back</Link>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{error && <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

				<div className="mb-6 flex justify-between items-center">
					<h2 className="text-lg font-semibold text-gray-900">All Invoices</h2>
					<button onClick={() => setShowCreate(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">+ New Invoice</button>
				</div>

				{loading ? (
					<div className="text-center py-12 text-gray-600">Loading invoices...</div>
				) : invoices.length === 0 ? (
					<div className="bg-white rounded-xl shadow p-12 text-center">
						<div className="text-6xl mb-4">📄</div>
						<h3 className="text-xl font-semibold text-gray-900 mb-2">No invoices yet</h3>
						<p className="text-gray-600">Create your first invoice to get started.</p>
					</div>
				) : (
					<div className="bg-white rounded-xl shadow overflow-x-auto">
						<table className="min-w-full border">
							<thead className="bg-gray-50 text-sm">
								<tr>
									<th className="px-4 py-3 text-left border">Invoice</th>
									<th className="px-4 py-3 text-left border">Customer</th>
									<th className="px-4 py-3 text-left border">Job</th>
									<th className="px-4 py-3 text-right border">Total</th>
									<th className="px-4 py-3 text-right border">Balance</th>
									<th className="px-4 py-3 text-left border">Status</th>
									<th className="px-4 py-3 text-right border">Actions</th>
								</tr>
							</thead>
							<tbody>
								{invoices.map((inv) => (
									<tr key={inv.id} className="text-sm hover:bg-gray-50">
										<td className="px-4 py-3 border">{inv.id.slice(0, 8).toUpperCase()}</td>
										<td className="px-4 py-3 border">{inv.customer?.name || inv.customerName || "—"}</td>
										<td className="px-4 py-3 border">{inv.job?.title || "—"}</td>
										<td className="px-4 py-3 border text-right">${inv.total.toFixed(2)}</td>
										<td className="px-4 py-3 border text-right">${inv.balance.toFixed(2)}</td>
										<td className="px-4 py-3 border">
											<span className={`px-2 py-1 rounded text-xs font-semibold ${inv.status === "PAID" ? "bg-green-100 text-green-700" : inv.status === "OVERDUE" ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"}`}>{inv.status}</span>
										</td>
										<td className="px-4 py-3 border text-right">
											{inv.balance > 0 && (
												<button onClick={() => setShowPay(inv.id)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Record Payment</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Create Invoice Modal */}
			{showCreate && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-xl font-bold text-gray-900">New Invoice</h3>
							<button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700">✕</button>
						</div>
						<form onSubmit={handleCreate} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<input placeholder="Job ID (optional)" value={jobId} onChange={(e) => setJobId(e.target.value)} className="border rounded px-3 py-2" />
								<input placeholder="Customer ID (optional)" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="border rounded px-3 py-2" />
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
									<input name="paymentDate" type="date" className="border rounded px-3 py-2 w-full" />
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




