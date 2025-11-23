"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { listInvoices, updateInvoicePDFs } from "../invoices/actions";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  issueDate: string | Date;
  dueDate: string | Date | null;
  total: number;
  balance: number;
  status: string;
  customer: { name: string } | null;
  job: { title: string | null; id?: string } | null;
  createdAt: string | Date;
  notes: string | null;
  pdfFiles: string | null; // JSON array of PDF URLs
  lines: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  payments: Array<{ paymentDate: string | Date; amount: number; method: string | null }>;
}

type SortField = "invoiceNumber" | "issueDate" | "total" | "status" | "customer" | "createdAt";
type SortDirection = "asc" | "desc";

export default function FinancePage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = (session?.user as any)?.role;
  const hasAccess = userRole === "ADMIN" || userRole === "MANAGER";

  // Wait for session to load
  if (sessionStatus === "loading") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [uploadingPDFs, setUploadingPDFs] = useState<Record<string, boolean>>({});
  const [selectedPDFFiles, setSelectedPDFFiles] = useState<Record<string, File[]>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const loadInvoices = async () => {
    setLoading(true);
    setError(undefined);

    try {
      const res = await listInvoices();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.ok) {
        setInvoices(res.invoices as Invoice[]);
        setFilteredInvoices(res.invoices as Invoice[]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...invoices];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceNumber?.toLowerCase().includes(query) ||
          inv.job?.title?.toLowerCase().includes(query) ||
          inv.job?.id?.toLowerCase().includes(query) ||
          inv.customer?.name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((inv) => {
        if (statusFilter === "PAID") return inv.status === "PAID";
        if (statusFilter === "PENDING") return inv.status === "SENT" || inv.status === "DRAFT";
        if (statusFilter === "OVERDUE") {
          if (inv.status === "PAID") return false;
          if (inv.dueDate) {
            try {
              return new Date(inv.dueDate).getTime() < new Date().getTime() && inv.balance > 0;
            } catch {
              return false;
            }
          }
          return false;
        }
        return inv.status === statusFilter;
      });
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((inv) => {
        try {
          return inv.issueDate ? new Date(inv.issueDate).getTime() >= fromDate.getTime() : false;
        } catch {
          return false;
        }
      });
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((inv) => {
        try {
          return inv.issueDate ? new Date(inv.issueDate).getTime() <= toDate.getTime() : false;
        } catch {
          return false;
        }
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case "invoiceNumber":
          aVal = a.invoiceNumber || "";
          bVal = b.invoiceNumber || "";
          break;
        case "issueDate":
          aVal = a.issueDate ? new Date(a.issueDate).getTime() : 0;
          bVal = b.issueDate ? new Date(b.issueDate).getTime() : 0;
          break;
        case "total":
          aVal = a.total;
          bVal = b.total;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "customer":
          aVal = a.customer?.name || "";
          bVal = b.customer?.name || "";
          break;
        case "createdAt":
          aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredInvoices(filtered);
  }, [invoices, searchQuery, statusFilter, dateFrom, dateTo, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getStatusBadge = (invoice: Invoice) => {
    let isOverdue = false;
    if (invoice.status !== "PAID" && invoice.dueDate && invoice.balance > 0) {
      try {
        isOverdue = new Date(invoice.dueDate).getTime() < new Date().getTime();
      } catch {
        isOverdue = false;
      }
    }

    if (isOverdue) {
      return (
        <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
          OVERDUE
        </span>
      );
    }

    switch (invoice.status) {
      case "PAID":
        return (
          <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">
            PAID
          </span>
        );
      case "SENT":
        return (
          <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
            PENDING
          </span>
        );
      case "DRAFT":
        return (
          <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700">
            DRAFT
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700">
            {invoice.status}
          </span>
        );
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getJobNumber = (invoice: Invoice) => {
    if (!invoice.job || !invoice.job.id) {
      // If no job ID, try to use invoice ID as fallback
      if (invoice.id && invoice.id.length >= 8) {
        return invoice.id.slice(0, 8).toUpperCase();
      }
      return "—";
    }
    return invoice.job.id.slice(0, 8).toUpperCase();
  };

  const handleUploadPDFs = async (invoiceId: string) => {
    const files = selectedPDFFiles[invoiceId];
    if (!files || files.length === 0) return;

    setUploadingPDFs((prev) => ({ ...prev, [invoiceId]: true }));
    setError(undefined);

    try {
      // Upload PDFs
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const uploadRes = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || "Failed to upload PDFs");
      }

      const uploadData = await uploadRes.json();
      const newPdfUrls = uploadData.paths || [];

      // Get existing PDFs
      const invoice = invoices.find((inv) => inv.id === invoiceId);
      let existingPdfs: string[] = [];
      if (invoice?.pdfFiles) {
        try {
          existingPdfs = JSON.parse(invoice.pdfFiles);
        } catch {
          existingPdfs = [];
        }
      }

      // Combine existing and new PDFs
      const allPdfs = [...existingPdfs, ...newPdfUrls];

      // Update invoice with new PDFs
      const res = await updateInvoicePDFs(invoiceId, allPdfs);
      if (!res.ok) {
        throw new Error(res.error || "Failed to save PDFs");
      }

      // Clear selected files and reload invoices
      setSelectedPDFFiles((prev) => {
        const updated = { ...prev };
        delete updated[invoiceId];
        return updated;
      });
      await loadInvoices();
    } catch (err: any) {
      setError(err?.message || "Failed to upload PDFs");
    } finally {
      setUploadingPDFs((prev) => ({ ...prev, [invoiceId]: false }));
    }
  };

  // Access control
  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-xl shadow-md p-8 max-w-lg text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-gray-600 mb-4">
            Finance tools are only available to managers and admins.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-24 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">💰 Finance</h1>
            <p className="text-sm text-gray-500">Track invoices and financial records</p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-full mx-auto px-24 py-8 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Invoice #, Job #, Customer..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="OVERDUE">Overdue</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Clear Filters */}
          {(searchQuery || statusFilter !== "ALL" || dateFrom || dateTo) && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-12 text-center">
            <p className="text-lg font-medium text-gray-900 mb-2">No invoices found</p>
            <p className="text-sm text-gray-600">
              {invoices.length === 0
                ? "No invoices have been created yet."
                : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          /* Invoice Table */
          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("invoiceNumber")}
                    >
                      <div className="flex items-center gap-2">
                        Invoice Number
                        {sortField === "invoiceNumber" && (
                          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("customer")}
                    >
                      <div className="flex items-center gap-2">
                        Client / Customer
                        {sortField === "customer" && (
                          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Number
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("total")}
                    >
                      <div className="flex items-center gap-2">
                        Amount
                        {sortField === "total" && (
                          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {sortField === "status" && (
                          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center gap-2">
                        Date Created
                        {sortField === "createdAt" && (
                          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PDF Files
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setShowDetails(true);
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.customer?.name || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getJobNumber(invoice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(invoice.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(invoice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(invoice.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-2">
                          {/* Display existing PDFs */}
                          {(() => {
                            try {
                              const pdfs = invoice.pdfFiles ? JSON.parse(invoice.pdfFiles) : [];
                              return pdfs.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {pdfs.map((pdfUrl: string, idx: number) => (
                                    <a
                                      key={idx}
                                      href={pdfUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                                    >
                                      PDF {idx + 1}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">No PDFs</span>
                              );
                            } catch {
                              return <span className="text-gray-400 text-xs">No PDFs</span>;
                            }
                          })()}
                          
                          {/* Upload PDF button */}
                          <div className="relative">
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              multiple
                              onChange={(e) => {
                                e.stopPropagation();
                                const files = Array.from(e.target.files || []);
                                if (files.length > 0) {
                                  setSelectedPDFFiles((prev) => ({
                                    ...prev,
                                    [invoice.id]: [...(prev[invoice.id] || []), ...files],
                                  }));
                                }
                              }}
                              className="hidden"
                              id={`pdf-upload-${invoice.id}`}
                            />
                            <label
                              htmlFor={`pdf-upload-${invoice.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                            >
                              + Add PDF
                            </label>
                          </div>
                          
                          {/* Show selected files and upload button */}
                          {selectedPDFFiles[invoice.id] && selectedPDFFiles[invoice.id].length > 0 && (
                            <div className="flex flex-col gap-1">
                              {selectedPDFFiles[invoice.id].map((file, idx) => (
                                <div key={idx} className="flex items-center gap-1 text-xs text-gray-600">
                                  <span className="truncate max-w-[100px]">{file.name}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPDFFiles((prev) => ({
                                        ...prev,
                                        [invoice.id]: prev[invoice.id].filter((_, i) => i !== idx),
                                      }));
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleUploadPDFs(invoice.id);
                                }}
                                disabled={uploadingPDFs[invoice.id]}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                              >
                                {uploadingPDFs[invoice.id] ? "Uploading..." : "Upload"}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-700">
                        View →
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invoice Details Modal */}
        {showDetails && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Invoice Details</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedInvoice.invoiceNumber || "No Invoice Number"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetails(false);
                      setSelectedInvoice(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Invoice Info */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
                      Invoice Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Invoice Number:</span>
                        <span className="font-medium">{selectedInvoice.invoiceNumber || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span>{getStatusBadge(selectedInvoice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Issue Date:</span>
                        <span className="font-medium">{formatDate(selectedInvoice.issueDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Due Date:</span>
                        <span className="font-medium">{formatDate(selectedInvoice.dueDate)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
                      Customer & Job
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer:</span>
                        <span className="font-medium">
                          {selectedInvoice.customer?.name || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Job Number:</span>
                        <span className="font-medium">{getJobNumber(selectedInvoice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Job Title:</span>
                        <span className="font-medium">
                          {selectedInvoice.job?.title || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Amount:</span>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(selectedInvoice.total)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Balance:</span>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(selectedInvoice.balance)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Paid:</span>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(selectedInvoice.total - selectedInvoice.balance)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Invoice Lines */}
                {selectedInvoice.lines && selectedInvoice.lines.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                      Invoice Items
                    </h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Description
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Quantity
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Rate
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedInvoice.lines.map((line, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 text-sm text-gray-900">{line.description}</td>
                              <td className="px-4 py-3 text-sm text-gray-500 text-right">
                                {line.quantity}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 text-right">
                                {formatCurrency(line.rate)}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                                {formatCurrency(line.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Payments */}
                {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                      Payments
                    </h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Method
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedInvoice.payments.map((payment, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {formatDate(payment.paymentDate)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {payment.method || "—"}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                                {formatCurrency(payment.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* PDF Files */}
                {(() => {
                  try {
                    const pdfs = selectedInvoice.pdfFiles ? JSON.parse(selectedInvoice.pdfFiles) : [];
                    return pdfs.length > 0 ? (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">PDF Files</h3>
                        <div className="space-y-2">
                          {pdfs.map((pdfUrl: string, idx: number) => (
                            <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                              <span className="text-sm text-gray-700">PDF {idx + 1}</span>
                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                View PDF
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  } catch {
                    return null;
                  }
                })()}

                {/* Notes */}
                {selectedInvoice.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">Notes</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      {selectedInvoice.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
