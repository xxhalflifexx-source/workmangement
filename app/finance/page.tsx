"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { listInvoices, updateInvoicePDFs, createInvoice, updateInvoice, updateInvoiceStatus, getUninvoicedJobs, getNextInvoiceNumber, deleteInvoice } from "../invoices/actions";
import { getJobForInvoice, getCompanySettingsForInvoice } from "../jobs/invoice-actions";
import { generateInvoicePDF, InvoicePDFData } from "@/lib/pdf-generator";
import { formatDateShort, formatDateTime, formatDateInput, todayCentralISO, nowInCentral, utcToCentral, centralToUTC } from "@/lib/date-utils";
import { getFinancialSummary } from "./actions";

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
  updatedAt?: string | Date;
  notes: string | null;
  remarks: string | null; // Admin notes/remarks
  pdfFiles: string | null; // JSON array of PDF URLs
  lines: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  payments: Array<{ paymentDate: string | Date; amount: number; method: string | null }>;
}

type SortField = "invoiceNumber" | "issueDate" | "total" | "status" | "customer" | "job" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";

export default function FinancePage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = (session?.user as any)?.role;
  const hasAccess = userRole === "ADMIN" || userRole === "MANAGER";
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"invoices" | "financials">("invoices");

  // Financials state
  const [finStart, setFinStart] = useState<string>(() => {
    const start = nowInCentral().startOf('year');
    return start.format('YYYY-MM-DD');
  });
  const [finEnd, setFinEnd] = useState<string>(todayCentralISO());
  const [finLoading, setFinLoading] = useState(false);
  const [finSummary, setFinSummary] = useState<any>(null);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
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

  // Create Invoice states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uninvoicedJobs, setUninvoicedJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState<Array<{ description: string; quantity: number; rate: number; amount: number }>>([
    { description: "", quantity: 1, rate: 0, amount: 0 },
  ]);
  const [invoiceIssueDate, setInvoiceIssueDate] = useState(todayCentralISO());
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [selectedJobData, setSelectedJobData] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // Editable customer fields for invoice
  const [editableCustomerName, setEditableCustomerName] = useState("");
  const [editableCustomerAddress, setEditableCustomerAddress] = useState("");
  const [editableCustomerPhone, setEditableCustomerPhone] = useState("");
  const [editableCustomerEmail, setEditableCustomerEmail] = useState("");
  
  // Payment Method fields
  const [paymentBank, setPaymentBank] = useState("");
  const [paymentAccountName, setPaymentAccountName] = useState("");
  const [paymentAccountNumber, setPaymentAccountNumber] = useState("");
  
  // Prepared By fields
  const [preparedByName, setPreparedByName] = useState("");
  const [preparedByTitle, setPreparedByTitle] = useState("");

  // Edit Invoice states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editLines, setEditLines] = useState<Array<{ description: string; quantity: number; rate: number; amount: number }>>([]);
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editPaymentBank, setEditPaymentBank] = useState("");
  const [editPaymentAccountName, setEditPaymentAccountName] = useState("");
  const [editPaymentAccountNumber, setEditPaymentAccountNumber] = useState("");
  const [editPreparedByName, setEditPreparedByName] = useState("");
  const [editPreparedByTitle, setEditPreparedByTitle] = useState("");
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [pendingEditData, setPendingEditData] = useState<any>(null);

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

  const loadInvoices = async () => {
    setLoading(true);
    setError(undefined);

    try {
      const res = await listInvoices();
      if (!res.ok) {
        setError(res.error || "Failed to load invoices");
        setInvoices([]);
        setFilteredInvoices([]);
        return;
      }
      if (res.ok && res.invoices) {
        // Ensure pdfFiles is handled safely
        const safeInvoices = (res.invoices as Invoice[]).map((inv: any) => ({
          ...inv,
          pdfFiles: inv.pdfFiles || null,
        }));
        setInvoices(safeInvoices);
        setFilteredInvoices(safeInvoices);
      }
    } catch (err: any) {
      console.error("Load invoices error:", err);
      setError(err?.message || "Failed to load invoices");
      setInvoices([]);
      setFilteredInvoices([]);
    } finally {
setLoading(false);
    }
	};

	useEffect(() => {
    loadInvoices();
	}, []);

  // Preload next invoice number whenever the create modal opens so we can show the exact number instead of "Auto-generated".
  useEffect(() => {
    const preloadInvoiceNumber = async () => {
      try {
        const next = await getNextInvoiceNumber();
        if (next) setInvoiceNumber(next);
      } catch (err) {
        console.error("Failed to preload invoice number", err);
      }
    };

    if (showCreateModal) {
      preloadInvoiceNumber();
    }
  }, [showCreateModal]);

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
        if (statusFilter === "PENDING") return inv.status === "PENDING";
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
      const fromDate = utcToCentral(dateFrom + "T00:00:00").toDate();
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((inv) => {
        try {
          return inv.issueDate ? utcToCentral(inv.issueDate).toDate().getTime() >= fromDate.getTime() : false;
        } catch {
          return false;
        }
      });
    }
    if (dateTo) {
      const toDate = utcToCentral(dateTo + "T23:59:59").toDate();
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((inv) => {
        try {
          return inv.issueDate ? utcToCentral(inv.issueDate).toDate().getTime() <= toDate.getTime() : false;
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
          aVal = a.issueDate ? utcToCentral(a.issueDate).toDate().getTime() : 0;
          bVal = b.issueDate ? utcToCentral(b.issueDate).toDate().getTime() : 0;
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
          aVal = a.createdAt ? utcToCentral(a.createdAt).toDate().getTime() : 0;
          bVal = b.createdAt ? utcToCentral(b.createdAt).toDate().getTime() : 0;
          break;
        case "updatedAt":
          aVal = a.updatedAt ? utcToCentral(a.updatedAt).toDate().getTime() : (a.createdAt ? utcToCentral(a.createdAt).toDate().getTime() : 0);
          bVal = b.updatedAt ? utcToCentral(b.updatedAt).toDate().getTime() : (b.createdAt ? utcToCentral(b.createdAt).toDate().getTime() : 0);
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
        isOverdue = utcToCentral(invoice.dueDate).toDate().getTime() < nowInCentral().toDate().getTime();
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
    return formatDateShort(date);
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


  const loadUninvoicedJobs = async () => {
    setLoadingJobs(true);
    setError(undefined);
    try {
      const res = await getUninvoicedJobs();
      if (res.ok && res.jobs) {
        setUninvoicedJobs(res.jobs);
      } else {
        setError(res.error || "Failed to load jobs");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load jobs");
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleJobSelect = async (jobId: string) => {
    setSelectedJobId(jobId);
    setLoadingJobs(true);
    try {
      // Load job data, company settings, and invoice number in parallel
      const [jobRes, settings, invoiceNum] = await Promise.all([
        getJobForInvoice(jobId),
        getCompanySettingsForInvoice(),
        getNextInvoiceNumber(),
      ]);

      setCompanySettings(settings);
      setInvoiceNumber(invoiceNum);

      if (jobRes.ok && jobRes.job) {
        setSelectedJobData(jobRes.job);
        
        // Initialize editable customer fields
        if (jobRes.job.customer) {
          setEditableCustomerName(jobRes.job.customer.name || "");
          setEditableCustomerAddress(jobRes.job.customer.company || "");
          setEditableCustomerPhone(jobRes.job.customer.phone || "");
          setEditableCustomerEmail(jobRes.job.customer.email || "");
        } else {
          setEditableCustomerName("");
          setEditableCustomerAddress("");
          setEditableCustomerPhone("");
          setEditableCustomerEmail("");
        }

        // Auto-populate invoice lines from job data
        const lines = [];
        
        // For Fixed Price jobs, add a single line item
        if (jobRes.job.pricingType === "FIXED" && (jobRes.job.finalPrice || jobRes.job.estimatedPrice)) {
          lines.push({
            description: jobRes.job.title,
            quantity: 1,
            rate: jobRes.job.finalPrice || jobRes.job.estimatedPrice || 0,
            amount: jobRes.job.finalPrice || jobRes.job.estimatedPrice || 0,
          });
        } else {
          // For T&M jobs, itemize labor and expenses
          if (jobRes.job.laborBreakdown && jobRes.job.laborBreakdown.length > 0) {
            jobRes.job.laborBreakdown.forEach((labor: any) => {
              if (labor.hours > 0) {
                lines.push({
                  description: `Labor - ${labor.name}`,
                  quantity: Math.round(labor.hours * 100) / 100,
                  rate: labor.rate,
                  amount: Math.round(labor.cost * 100) / 100,
                });
              }
            });
          }
          if (jobRes.job.expenses && jobRes.job.expenses.length > 0) {
            jobRes.job.expenses.forEach((expense: any) => {
              lines.push({
                description: `${expense.category} - ${expense.description}`,
                quantity: expense.quantity || 1,
                rate: expense.amount / (expense.quantity || 1),
                amount: expense.amount,
              });
            });
          }
        }
        
        if (lines.length === 0) {
          lines.push({ description: jobRes.job.title, quantity: 1, rate: 0, amount: 0 });
        }
        setInvoiceLines(lines);
      } else {
        setError(jobRes.error || "Failed to load job data");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load job data");
    } finally {
      setLoadingJobs(false);
    }
  };

  const addInvoiceLine = () => {
    setInvoiceLines([...invoiceLines, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const updateInvoiceLine = (index: number, field: string, value: any) => {
    const updated = [...invoiceLines];
    const line = updated[index];
    if (field === "description") {
      line.description = value;
    } else if (field === "quantity") {
      line.quantity = value;
      line.amount = line.quantity * line.rate;
    } else if (field === "rate") {
      line.rate = value;
      line.amount = line.quantity * line.rate;
    }
    setInvoiceLines(updated);
  };

  const removeInvoiceLine = (index: number) => {
    setInvoiceLines(invoiceLines.filter((_, i) => i !== index));
  };

  const calculateInvoiceSubtotal = () => {
    return invoiceLines.reduce((sum, line) => sum + line.amount, 0);
  };

  const calculateInvoiceTotal = () => {
    return calculateInvoiceSubtotal() + (shippingFee || 0);
  };

  const handleDownloadPDF = async () => {
    if (!selectedJobData || !companySettings) {
      setError("Job data or company settings not loaded");
      return;
    }

    const subtotal = calculateInvoiceSubtotal();
    const total = calculateInvoiceTotal();

    // Don't add shipping fee as a line item - it should only appear in the summary section
    // Filter out any existing "Shipping Fee" line items to avoid duplication
    const regularLines = invoiceLines.filter(line => 
      !line.description.toLowerCase().includes('shipping fee')
    );

    // Attempt to fetch logo and convert to data URL for embedding
    let logoDataUrl: string | undefined;
    if (companySettings.logoUrl) {
      try {
        const resp = await fetch(companySettings.logoUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          const reader = new FileReader();
          logoDataUrl = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (error) {
        console.error("Error loading logo for invoice:", error);
      }
    }

    const pdfData: InvoicePDFData = {
      invoiceNumber: invoiceNumber || "TEMP",
      invoiceDate: invoiceIssueDate,
      companyName: companySettings?.companyName || "TCB METAL WORKS",
      companyAddress: companySettings?.address || undefined,
      companyCity: companySettings?.city || undefined,
      companyState: companySettings?.state || undefined,
      companyZipCode: companySettings?.zipCode || undefined,
      companyPhone: companySettings?.phone || undefined,
      companyEmail: companySettings?.email || undefined,
      logoDataUrl,
      customerName: editableCustomerName || selectedJobData.customer?.name || "Customer",
      customerAddress: editableCustomerAddress || selectedJobData.customer?.company || undefined,
      customerPhone: editableCustomerPhone || selectedJobData.customer?.phone || undefined,
      customerEmail: editableCustomerEmail || selectedJobData.customer?.email || undefined,
      lineItems: regularLines,
      subtotal: subtotal,
      shippingFee: shippingFee || 0,
      total: total,
      notes: invoiceNotes || undefined,
      paymentBank: paymentBank || undefined,
      paymentAccountName: paymentAccountName || undefined,
      paymentAccountNumber: paymentAccountNumber || undefined,
      preparedByName: preparedByName || undefined,
      preparedByTitle: preparedByTitle || undefined,
    };

    const pdf = await generateInvoicePDF(pdfData);
    pdf.save(`${invoiceNumber || "INV"}-${todayCentralISO()}.pdf`);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId) {
      setError("Please select a job");
      return;
    }

    setCreatingInvoice(true);
    setError(undefined);

    try {
      // Prepare line items including shipping fee as a line item if > 0
      const lines = [...invoiceLines];
      if (shippingFee > 0) {
        lines.push({
          description: "Shipping Fee",
          quantity: 1,
          rate: shippingFee,
          amount: shippingFee,
        });
      }

      const formData = new FormData();
      formData.append("jobId", selectedJobId);
      if (selectedJobData?.customer?.id) {
        formData.append("customerId", selectedJobData.customer.id);
      }
      formData.append("issueDate", invoiceIssueDate);
      if (invoiceDueDate) {
        formData.append("dueDate", invoiceDueDate);
      }
      formData.append("notes", invoiceNotes || "");
      formData.append("lines", JSON.stringify(lines));
      formData.append("sentDate", todayCentralISO());

      const res = await createInvoice(formData);
      if (!res.ok) {
        setError(res.error || "Failed to create invoice");
        return;
      }

      // Store invoice number for PDF generation
      if (res.invoice?.invoiceNumber) {
        setInvoiceNumber(res.invoice.invoiceNumber);
      }

      // Reset form
      setShowCreateModal(false);
      setSelectedJobId("");
      setSelectedJobData(null);
      setInvoiceLines([{ description: "", quantity: 1, rate: 0, amount: 0 }]);
      setInvoiceIssueDate(todayCentralISO());
      setInvoiceDueDate("");
      setInvoiceNotes("");
      setShippingFee(0);
      setEditableCustomerName("");
      setEditableCustomerAddress("");
      setEditableCustomerPhone("");
      setEditableCustomerEmail("");

      // Reload invoices
      await loadInvoices();
    } catch (err: any) {
      setError(err?.message || "Failed to create invoice");
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleEditInvoice = async (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setEditLines(invoice.lines || []);
    setEditDueDate(invoice.dueDate ? formatDateInput(invoice.dueDate) : "");
    setEditNotes(invoice.notes || "");
    setEditRemarks(invoice.remarks || "");
    setEditStatus(invoice.status);
    
    // Initialize payment method and prepared by fields (can be stored in notes as JSON or separate)
    setEditPaymentBank("");
    setEditPaymentAccountName("");
    setEditPaymentAccountNumber("");
    setEditPreparedByName("");
    setEditPreparedByTitle("");
    
    // Load company settings for PDF generation
    if (!companySettings) {
      const settings = await getCompanySettingsForInvoice();
      setCompanySettings(settings);
    }
    
    setShowEditModal(true);
  };

  const calculateEditSubtotal = () => {
    return editLines.reduce((sum, line) => sum + line.amount, 0);
  };

  const handleDownloadEditPDF = async () => {
    if (!editingInvoice || !companySettings) {
      setError("Invoice data or company settings not loaded");
      return;
    }

    const subtotal = calculateEditSubtotal();
    const total = subtotal;

    // Attempt to fetch logo and convert to data URL for embedding
    let logoDataUrl: string | undefined;
    if (companySettings.logoUrl) {
      try {
        const resp = await fetch(companySettings.logoUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          const reader = new FileReader();
          logoDataUrl = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (error) {
        console.error("Error loading logo for invoice:", error);
      }
    }

    const pdfData: InvoicePDFData = {
      invoiceNumber: editingInvoice.invoiceNumber || "TEMP",
      invoiceDate: typeof editingInvoice.issueDate === 'string' ? editingInvoice.issueDate : formatDateInput(editingInvoice.issueDate),
      companyName: companySettings?.companyName || "TCB METAL WORKS",
      companyAddress: companySettings?.address || undefined,
      companyCity: companySettings?.city || undefined,
      companyState: companySettings?.state || undefined,
      companyZipCode: companySettings?.zipCode || undefined,
      companyPhone: companySettings?.phone || undefined,
      companyEmail: companySettings?.email || undefined,
      logoDataUrl,
      customerName: editingInvoice.customer?.name || "Customer",
      customerAddress: undefined,
      customerPhone: undefined,
      customerEmail: undefined,
      lineItems: editLines,
      subtotal: subtotal,
      shippingFee: 0,
      total: total,
      notes: editNotes || undefined,
      paymentBank: editPaymentBank || undefined,
      paymentAccountName: editPaymentAccountName || undefined,
      paymentAccountNumber: editPaymentAccountNumber || undefined,
      preparedByName: editPreparedByName || undefined,
      preparedByTitle: editPreparedByTitle || undefined,
    };

    const pdf = await generateInvoicePDF(pdfData);
    pdf.save(`${editingInvoice.invoiceNumber || "INV"}-${todayCentralISO()}.pdf`);
  };

  const updateEditLine = (index: number, field: string, value: any) => {
    const updated = [...editLines];
    const line = updated[index];
    if (field === "description") {
      line.description = value;
    } else if (field === "quantity") {
      line.quantity = value;
      line.amount = line.quantity * line.rate;
    } else if (field === "rate") {
      line.rate = value;
      line.amount = line.quantity * line.rate;
    }
    setEditLines(updated);
  };

  const addEditLine = () => {
    setEditLines([...editLines, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeEditLine = (index: number) => {
    setEditLines(editLines.filter((_, i) => i !== index));
  };

  const handleSaveEditInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    // Prepare edit data
    const formData = new FormData();
    formData.append("invoiceId", editingInvoice.id);
    if (editDueDate) {
      formData.append("dueDate", editDueDate);
    }
    formData.append("notes", editNotes || "");
    formData.append("remarks", editRemarks || "");
    formData.append("status", editStatus);
    formData.append("lines", JSON.stringify(editLines));

    // Store pending data and show confirmation
    setPendingEditData(formData);
    setShowEditConfirm(true);
  };

  const confirmEditInvoice = async () => {
    if (!editingInvoice || !pendingEditData) return;

    setSavingInvoice(true);
    setError(undefined);

    try {
      const res = await updateInvoice(pendingEditData);
      if (!res.ok) {
        setError(res.error || "Failed to update invoice");
        return;
      }

      setShowEditModal(false);
      setShowEditConfirm(false);
      setEditingInvoice(null);
      setPendingEditData(null);
      await loadInvoices();
    } catch (err: any) {
      setError(err?.message || "Failed to update invoice");
    } finally {
      setSavingInvoice(false);
    }
  };

  const cancelEditInvoice = () => {
    setShowEditConfirm(false);
    setPendingEditData(null);
  };

  const handleStatusChange = (newStatus: string) => {
    setPendingStatus(newStatus);
    setShowStatusConfirm(true);
  };

  const confirmStatusChange = async () => {
    if (!editingInvoice || !pendingStatus) return;

    setSavingInvoice(true);
    setError(undefined);

    try {
      const res = await updateInvoiceStatus(editingInvoice.id, pendingStatus);
      if (!res.ok) {
        setError(res.error || "Failed to update status");
        return;
      }

      setEditStatus(pendingStatus);
      setShowStatusConfirm(false);
      setPendingStatus("");
      await loadInvoices();
    } catch (err: any) {
      setError(err?.message || "Failed to update status");
    } finally {
      setSavingInvoice(false);
    }
  };

  const loadFinancials = async () => {
    setFinLoading(true);
    setError(undefined);
    const res = await getFinancialSummary(finStart, finEnd);
    if (!res.ok) {
      setError(res.error);
      setFinSummary(null);
    } else {
      setFinSummary(res.summary);
    }
    setFinLoading(false);
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
          const parsed = typeof invoice.pdfFiles === 'string' 
            ? JSON.parse(invoice.pdfFiles) 
            : invoice.pdfFiles;
          existingPdfs = Array.isArray(parsed) ? parsed : [];
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

  // Access control - Check role first, then permissions
  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-xl shadow-md p-8 max-w-lg text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-gray-600 mb-4">
            Finance tools are only available to managers and admins with proper permissions.
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

  // Additional permission check (if RBAC is enabled)
  // This will be checked server-side in a real implementation

	return (
		<main className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
					<div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">💰 Finance</h1>
            <p className="text-xs sm:text-sm text-gray-500">Manage invoices and view financial summaries</p>
					</div>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Back to Dashboard
					</Link>
				</div>
			</header>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {success}
            <button
              onClick={() => setSuccess(undefined)}
              className="float-right text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
            <button
              onClick={() => setError(undefined)}
              className="float-right text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
              <button
                onClick={() => setActiveTab("invoices")}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap min-h-[44px] flex items-center ${
                  activeTab === "invoices"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                📄 <span className="ml-1 sm:ml-0">Invoices</span>
              </button>
              {hasAccess && (
                <button
                  onClick={() => setActiveTab("financials")}
                  className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap min-h-[44px] flex items-center ${
                    activeTab === "financials"
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  💹 <span className="ml-1 sm:ml-0">Financials</span>
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
        <div>
          <div className="space-y-4 sm:space-y-6">
            {/* Header with Create Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Invoices</h2>
              {hasAccess && (
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    loadUninvoicedJobs();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium min-h-[44px]"
                >
                  + Create Invoice
                </button>
              )}
            </div>

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
                    <option value="ALL">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="CANCELLED">Cancelled</option>
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
              // Invoice Table
              <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle px-4 sm:px-0">
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
                          onClick={() => handleSort("job")}
                        >
                          <div className="flex items-center gap-2">
                            Job #
                            {sortField === "job" && (
                              <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Job Title
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
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort("updatedAt")}
                        >
                          <div className="flex items-center gap-2">
                            Updated At
                            {sortField === "updatedAt" && (
                              <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Remarks
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          PDF Files
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getJobNumber(invoice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.job?.title || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.customer?.name || "—"}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(invoice.updatedAt || invoice.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm max-w-xs" onClick={(e) => e.stopPropagation()}>
                        {hasAccess ? (
                          <input
                            type="text"
                            value={invoice.remarks || ""}
                            onChange={(e) => {
                              // Only update local state, don't save yet
                              const updatedInvoices = invoices.map((inv) =>
                                inv.id === invoice.id ? { ...inv, remarks: e.target.value } : inv
                              );
                              setInvoices(updatedInvoices);
                            }}
                            onBlur={async (e) => {
                              // Save only when user clicks away (blur event)
                              const newRemarks = e.target.value;
                              try {
                                const formData = new FormData();
                                formData.append("invoiceId", invoice.id);
                                formData.append("remarks", newRemarks);
                                await updateInvoice(formData);
                                // Reload to get latest data
                                await loadInvoices();
                              } catch (err) {
                                console.error("Failed to update remarks:", err);
                                // Reload on error to restore original value
                                await loadInvoices();
                              }
                            }}
                            placeholder="Add remarks..."
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="text-gray-500 text-xs">
                            {invoice.remarks || "—"}
                          </span>
                        )}
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
                                  <span className="truncate max-w-[100px] sm:max-w-[200px]" title={file.name}>{file.name}</span>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoice(invoice);
                              setShowDetails(true);
                            }}
                            className="px-3 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                          >
                            View
                          </button>
                          {hasAccess && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditInvoice(invoice);
                                }}
                                className="px-3 py-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
                                    const res = await deleteInvoice(invoice.id);
                                    if (res.ok) {
                                      await loadInvoices();
                                      setSuccess("Invoice deleted successfully");
                                    } else {
                                      setError(res.error || "Failed to delete invoice");
                                    }
                                  }
                                }}
                                className="px-3 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                              >
                                Delete
                              </button>
                            </>
                          )}
							</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                  </table>
							</div>
							</div>
							</div>
            )}
						</div>
        </div>
        )}

        {/* Financials Tab */}
        {activeTab === "financials" && (
          <div className="bg-white rounded-xl shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Company Financials</h2>
                <p className="text-sm text-gray-500">Revenue, labor, expenses, profit, and bankroll</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto">
                <input 
                  type="date" 
                  value={finStart} 
                  onChange={(e) => setFinStart(e.target.value)} 
                  className="border rounded-lg px-3 py-2.5 sm:py-1.5 text-sm min-h-[44px] flex-1 sm:flex-none" 
                />
                <span className="text-gray-500 text-center sm:text-left">to</span>
                <input 
                  type="date" 
                  value={finEnd} 
                  onChange={(e) => setFinEnd(e.target.value)} 
                  className="border rounded-lg px-3 py-2.5 sm:py-1.5 text-sm min-h-[44px] flex-1 sm:flex-none" 
                />
                <button 
                  onClick={loadFinancials} 
                  className="px-4 py-2.5 sm:py-2 border rounded-lg text-sm hover:bg-gray-50 min-h-[44px] bg-blue-600 text-white hover:bg-blue-700"
                >
                  Run
                </button>
              </div>
            </div>

            {finLoading ? (
              <div className="p-8 text-center text-gray-600">Calculating...</div>
            ) : finSummary ? (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg bg-green-50">
                    <div className="text-sm text-green-700">Revenue</div>
                    <div className="text-2xl font-bold text-green-800">${finSummary.revenue.toFixed(2)}</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-blue-50">
                    <div className="text-sm text-blue-700">Labor Cost</div>
                    <div className="text-2xl font-bold text-blue-800">${finSummary.labor.cost.toFixed(2)}</div>
                    <div className="text-xs text-blue-700">{finSummary.labor.hours.toFixed(2)} hrs</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-yellow-50">
                    <div className="text-sm text-yellow-700">Expenses</div>
                    <div className="text-2xl font-bold text-yellow-800">${finSummary.expenses.total.toFixed(2)}</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-purple-50">
                    <div className="text-sm text-purple-700">Profit</div>
                    <div className={`text-2xl font-bold ${finSummary.profit >= 0 ? "text-purple-800" : "text-red-700"}`}>${finSummary.profit.toFixed(2)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 p-4 border rounded-lg">
                    <h3 className="font-semibold mb-3">Expenses by Category</h3>
                    {Object.keys(finSummary.expenses.byCategory).length === 0 ? (
                      <div className="text-sm text-gray-500">No expenses in this period.</div>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {Object.entries(finSummary.expenses.byCategory).map(([cat, amt]: any) => (
                          <li key={cat} className="flex justify-between"><span>{cat}</span><span className="font-medium">${(amt as number).toFixed(2)}</span></li>
                        ))}
                      </ul>
                    )}
											</div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-3">Bankroll</h3>
                    <div className="text-3xl font-bold">${finSummary.bankroll.toFixed(2)}</div>
                    <p className="text-xs text-gray-500 mt-2">Calculated as profit for selected period. Add opening balance logic later if needed.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-gray-600">Select a date range and click Run.</div>
            )}
          </div>
        )}

        {/* Invoice Details Modal */}
        {showDetails && selectedInvoice && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-[var(--brand-border)] max-w-3xl w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="p-5 sm:p-7">
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Invoice Details</h2>
                    <p className="text-sm text-slate-500 font-medium">
                      {selectedInvoice.invoiceNumber || "No Invoice Number"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetails(false);
                      setSelectedInvoice(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none rounded-full p-1.5 transition-colors"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Invoice Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
                  <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-muted)] p-4">
                    <h3 className="text-xs font-semibold text-slate-600 tracking-[0.08em] uppercase mb-3">
                      Invoice Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Invoice Number</span>
                        <span className="font-semibold text-slate-900">{selectedInvoice.invoiceNumber || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Status</span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1">
                          {getStatusBadge(selectedInvoice)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Issue Date</span>
                        <span className="font-semibold text-slate-900">{formatDate(selectedInvoice.issueDate)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Due Date</span>
                        <span className="font-semibold text-slate-900">{formatDate(selectedInvoice.dueDate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-muted)] p-4">
                    <h3 className="text-xs font-semibold text-slate-600 tracking-[0.08em] uppercase mb-3">
                      Customer & Job
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Customer</span>
                        <span className="font-semibold text-slate-900">
                          {selectedInvoice.customer?.name || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Job Number</span>
                        <span className="font-semibold text-slate-900">{getJobNumber(selectedInvoice)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Job Title</span>
                        <span className="font-semibold text-slate-900">
                          {selectedInvoice.job?.title || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="rounded-2xl border border-[var(--brand-border)] bg-gradient-to-br from-white via-[var(--brand-surface-muted)] to-white p-4 sm:p-5 mb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-3.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Total Amount</span>
                      <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatCurrency(selectedInvoice.total)}</p>
                    </div>
                    <div className="rounded-xl bg-orange-50 border border-orange-100 p-3.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-orange-700">Balance</span>
                      <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatCurrency(selectedInvoice.balance)}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Paid</span>
                      <p className="text-2xl font-extrabold text-emerald-700 mt-1">{formatCurrency(selectedInvoice.total - selectedInvoice.balance)}</p>
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
                    if (!selectedInvoice.pdfFiles) {
                      return null;
                    }
                    const parsed = typeof selectedInvoice.pdfFiles === 'string' 
                      ? JSON.parse(selectedInvoice.pdfFiles) 
                      : selectedInvoice.pdfFiles;
                    const pdfs = Array.isArray(parsed) ? parsed : [];
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

        {/* Create Invoice Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-[var(--brand-border)] max-w-4xl w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="p-5 sm:p-7">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">Billing</p>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Create Invoice</h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setSelectedJobId("");
                      setSelectedJobData(null);
                      setInvoiceLines([{ description: "", quantity: 1, rate: 0, amount: 0 }]);
                      setInvoiceIssueDate(todayCentralISO());
                      setInvoiceDueDate("");
                      setInvoiceNotes("");
                    }}
                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none rounded-full p-1.5 transition-colors"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateInvoice} className="space-y-7">
                  {/* Header Actions */}
                  <div className="flex justify-end gap-2">
                    {selectedJobId && companySettings && (
                      <button
                        type="button"
                        onClick={handleDownloadPDF}
                        className="px-4 py-2 bg-[var(--brand-blue)] text-white rounded-xl hover:bg-[var(--brand-blue-strong)] shadow-subtle font-semibold text-sm transition-colors"
                      >
                        📥 Download PDF
                      </button>
                    )}
                  </div>

                  {/* Job Selection */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-800">
                      Select Job <span className="text-red-500">*</span>
                    </label>
                    {loadingJobs ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600 mt-2">Loading jobs...</p>
                      </div>
                    ) : (
                      <select
                        value={selectedJobId}
                        onChange={(e) => handleJobSelect(e.target.value)}
                        className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-3 text-base bg-white shadow-inner"
                        required
                      >
                        <option value="">-- Select a job --</option>
                        {uninvoicedJobs.map((job: any) => (
                          <option key={job.id} value={job.id}>
                            {job.title} {job.customer ? `- ${job.customer.name}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    {uninvoicedJobs.length === 0 && !loadingJobs && (
                      <p className="text-sm text-gray-500 mt-2">All jobs have been invoiced.</p>
				)}
			</div>

                  {/* Invoice Number and Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-slate-800">
                        Invoice Number
                      </label>
                      <input
                        type="text"
                        value={invoiceNumber || "Generating..."}
                        disabled
                        className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-3 text-base bg-[var(--brand-surface-muted)] text-slate-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-slate-800">
                        Issue Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={invoiceIssueDate}
                        onChange={(e) => setInvoiceIssueDate(e.target.value)}
                        className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-3 text-base"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-slate-800">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={invoiceDueDate}
                        onChange={(e) => setInvoiceDueDate(e.target.value)}
                        className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-3 text-base"
                      />
                    </div>
                  </div>

                  {/* Customer Information (Editable) */}
                  {selectedJobData && (
                    <div className="bg-[var(--brand-surface-muted)] border border-[var(--brand-border)] rounded-2xl p-4 sm:p-5 shadow-inner">
                      <h3 className="text-xs font-semibold text-slate-600 tracking-[0.08em] uppercase mb-3">Bill To</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Customer Name</label>
                          <input
                            type="text"
                            value={editableCustomerName}
                            onChange={(e) => setEditableCustomerName(e.target.value)}
                            className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm"
                            placeholder="Customer Name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Address</label>
                          <input
                            type="text"
                            value={editableCustomerAddress}
                            onChange={(e) => setEditableCustomerAddress(e.target.value)}
                            className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm"
                            placeholder="Address"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Phone</label>
                          <input
                            type="text"
                            value={editableCustomerPhone}
                            onChange={(e) => setEditableCustomerPhone(e.target.value)}
                            className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm"
                            placeholder="Phone"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Email</label>
                          <input
                            type="email"
                            value={editableCustomerEmail}
                            onChange={(e) => setEditableCustomerEmail(e.target.value)}
                            className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm"
                            placeholder="Email"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Invoice Lines */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-800">
                        Line Items
                      </label>
                    </div>

                    {/* Mobile: stacked cards for full readability */}
                    <div className="space-y-3 sm:hidden">
                      {invoiceLines.map((line, index) => (
                        <div key={index} className="rounded-2xl border border-[var(--brand-border)] bg-white p-3 shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.08em]">Item {index + 1}</p>
                            {invoiceLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeInvoiceLine(index)}
                                className="text-red-500 hover:text-red-700 text-sm font-semibold"
                                aria-label="Remove line item"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">Description</label>
                              <input
                                type="text"
                                value={line.description}
                                onChange={(e) => updateInvoiceLine(index, "description", e.target.value)}
                                className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-2.5 text-base"
                                placeholder="Item description"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-slate-600 mb-1">Quantity</label>
                                <input
                                  type="number"
                                  value={line.quantity}
                                  onChange={(e) => updateInvoiceLine(index, "quantity", parseFloat(e.target.value) || 0)}
                                  className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-2.5 text-base text-right"
                                  step="0.01"
                                  min="0"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-600 mb-1">Rate</label>
                                <input
                                  type="number"
                                  value={line.rate}
                                  onChange={(e) => updateInvoiceLine(index, "rate", parseFloat(e.target.value) || 0)}
                                  className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-2.5 text-base text-right"
                                  step="0.01"
                                  min="0"
                                  required
                                />
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-slate-700">Amount</span>
                              <span className="text-lg font-extrabold text-slate-900">{formatCurrency(line.amount)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addInvoiceLine}
                        className="w-full justify-center inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-[var(--brand-border)] rounded-xl hover:border-[var(--brand-blue)] hover:bg-blue-50 transition-colors text-sm font-semibold text-slate-700"
                      >
                        + Add Line Item
                      </button>
                      
                      {/* Summary Section - Similar to Quotation */}
                      <div className="flex justify-end mt-4">
                        <div className="w-64">
                          <div className="flex justify-between py-2 border-b border-gray-300">
                            <span className="font-semibold">Subtotal:</span>
                            <span>{formatCurrency(calculateInvoiceSubtotal())}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-gray-300">
                            <span className="font-semibold">Shipping Fee:</span>
                            <input
                              type="number"
                              value={shippingFee}
                              onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                              className="w-20 text-right border-b border-gray-300 focus:border-blue-500 outline-none"
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <div className="flex justify-between py-3 border-t-2 border-blue-600">
                            <span className="text-lg font-bold">Total:</span>
                            <span className="text-lg font-bold text-blue-600">{formatCurrency(calculateInvoiceTotal())}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Desktop: table view */}
                    <div className="hidden sm:block">
                      <div className="border border-[var(--brand-border)] rounded-2xl overflow-hidden shadow-sm">
                        <table className="min-w-full divide-y divide-[var(--brand-border)]">
                          <thead className="bg-[var(--brand-surface-muted)]">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Description</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Quantity</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Rate</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Amount</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase w-20">Action</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-[var(--brand-border)]">
                            {invoiceLines.map((line, index) => (
                            <tr key={index}>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={line.description}
                                  onChange={(e) => updateInvoiceLine(index, "description", e.target.value)}
                                  className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm"
                                  placeholder="Item description"
                                  required
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  value={line.quantity}
                                  onChange={(e) => updateInvoiceLine(index, "quantity", parseFloat(e.target.value) || 0)}
                                  className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm text-right"
                                  step="0.01"
                                  min="0"
                                  required
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  value={line.rate}
                                  onChange={(e) => updateInvoiceLine(index, "rate", parseFloat(e.target.value) || 0)}
                                  className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm text-right"
                                  step="0.01"
                                  min="0"
                                  required
                                />
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {formatCurrency(line.amount)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {invoiceLines.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeInvoiceLine(index)}
                                    className="text-red-500 hover:text-red-700 text-sm font-semibold"
                                  >
                                    ✕
                                  </button>
                                )}
                              </td>
                            </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        type="button"
                        onClick={addInvoiceLine}
                        className="mt-4 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                      >
                        + Add Line Item
                      </button>
                      
                      {/* Summary Section - Similar to Quotation */}
                      <div className="flex justify-end mt-4">
                        <div className="w-64">
                          <div className="flex justify-between py-2 border-b border-gray-300">
                            <span className="font-semibold">Subtotal:</span>
                            <span>{formatCurrency(calculateInvoiceSubtotal())}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-gray-300">
                            <span className="font-semibold">Shipping Fee:</span>
                            <input
                              type="number"
                              value={shippingFee}
                              onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                              className="w-20 text-right border-b border-gray-300 focus:border-blue-500 outline-none"
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <div className="flex justify-between py-3 border-t-2 border-blue-600">
                            <span className="text-lg font-bold">Total:</span>
                            <span className="text-lg font-bold text-blue-600">{formatCurrency(calculateInvoiceTotal())}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={invoiceNotes}
                      onChange={(e) => setInvoiceNotes(e.target.value)}
                      rows={3}
                      className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-3 text-base bg-white shadow-inner"
                      placeholder="Payment terms, work scope, warranty information..."
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="bg-[var(--brand-surface-muted)] border border-[var(--brand-border)] rounded-2xl p-4 sm:p-5 shadow-inner">
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-[0.08em] mb-3">Payment Method</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Bank</label>
                        <input
                          type="text"
                          value={paymentBank}
                          onChange={(e) => setPaymentBank(e.target.value)}
                          className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm"
                          placeholder="Bank Name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Account Name</label>
                        <input
                          type="text"
                          value={paymentAccountName}
                          onChange={(e) => setPaymentAccountName(e.target.value)}
                          className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm"
                          placeholder="Account Name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Account Number</label>
                        <input
                          type="text"
                          value={paymentAccountNumber}
                          onChange={(e) => setPaymentAccountNumber(e.target.value)}
                          className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm"
                          placeholder="Account Number"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prepared By */}
                  <div className="bg-[var(--brand-surface-muted)] border border-[var(--brand-border)] rounded-2xl p-4 sm:p-5 shadow-inner">
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-[0.08em] mb-3">Prepared By</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Name</label>
                        <input
                          type="text"
                          value={preparedByName}
                          onChange={(e) => setPreparedByName(e.target.value)}
                          className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm"
                          placeholder="Prepared By Name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Title</label>
                        <input
                          type="text"
                          value={preparedByTitle}
                          onChange={(e) => setPreparedByTitle(e.target.value)}
                          className="w-full border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm"
                          placeholder="Title/Position"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setSelectedJobId("");
                        setSelectedJobData(null);
                        setInvoiceLines([{ description: "", quantity: 1, rate: 0, amount: 0 }]);
                        setInvoiceIssueDate(todayCentralISO());
                        setInvoiceDueDate("");
                        setInvoiceNotes("");
                        setShippingFee(0);
                        setEditableCustomerName("");
                        setEditableCustomerAddress("");
                        setEditableCustomerPhone("");
                        setEditableCustomerEmail("");
                        setInvoiceNumber("");
                        setPaymentBank("");
                        setPaymentAccountName("");
                        setPaymentAccountNumber("");
                        setPreparedByName("");
                        setPreparedByTitle("");
                      }}
                      className="px-4 py-2.5 border border-[var(--brand-border)] rounded-xl hover:bg-[var(--brand-surface-muted)] transition-colors font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingInvoice || !selectedJobId}
                      className="px-4 py-2.5 bg-[var(--brand-blue)] text-white rounded-xl hover:bg-[var(--brand-blue-strong)] transition-colors font-semibold shadow-subtle disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      {creatingInvoice ? "Creating..." : "Create Invoice"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Invoice Modal */}
        {showEditModal && editingInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Edit Invoice</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {editingInvoice.invoiceNumber || "No Invoice Number"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {companySettings && (
                      <button
                        type="button"
                        onClick={handleDownloadEditPDF}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                      >
                        📥 Download PDF
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingInvoice(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveEditInvoice} className="space-y-7">
                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="PAID">Paid</option>
                      <option value="OVERDUE">Overdue</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Invoice Lines */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-800">
                        Line Items
                      </label>
                      <span className="text-xs text-slate-500">Taxes & shipping handled below</span>
                    </div>

                    {/* Mobile: stacked cards */}
                    <div className="space-y-3 sm:hidden">
                      {editLines.map((line, index) => (
                        <div key={index} className="rounded-2xl border border-[var(--brand-border)] bg-white p-3 shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-[0.08em]">Item {index + 1}</p>
                            {editLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeEditLine(index)}
                                className="text-red-500 hover:text-red-700 text-sm font-semibold"
                                aria-label="Remove line item"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">Description</label>
                              <input
                                type="text"
                                value={line.description}
                                onChange={(e) => updateEditLine(index, "description", e.target.value)}
                                className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-2.5 text-base"
                                placeholder="Item description"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-slate-600 mb-1">Quantity</label>
                                <input
                                  type="number"
                                  value={line.quantity}
                                  onChange={(e) => updateEditLine(index, "quantity", parseFloat(e.target.value) || 0)}
                                  className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-2.5 text-base text-right"
                                  step="0.01"
                                  min="0"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-600 mb-1">Rate</label>
                                <input
                                  type="number"
                                  value={line.rate}
                                  onChange={(e) => updateEditLine(index, "rate", parseFloat(e.target.value) || 0)}
                                  className="w-full border border-[var(--brand-border)] rounded-xl px-3 py-2.5 text-base text-right"
                                  step="0.01"
                                  min="0"
                                  required
                                />
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-slate-700">Amount</span>
                              <span className="text-lg font-extrabold text-slate-900">{formatCurrency(line.amount)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-muted)] p-3 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">Total</span>
                          <span className="text-xl font-extrabold text-slate-900">{formatCurrency(editLines.reduce((sum, line) => sum + line.amount, 0))}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addEditLine}
                        className="w-full justify-center inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-[var(--brand-border)] rounded-xl hover:border-[var(--brand-blue)] hover:bg-blue-50 transition-colors text-sm font-semibold text-slate-700"
                      >
                        + Add Line Item
                      </button>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block">
                      <div className="border border-gray-300 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">Action</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {editLines.map((line, index) => (
                              <tr key={index}>
                                <td className="px-4 py-3">
                                  <input
                                    type="text"
                                    value={line.description}
                                    onChange={(e) => updateEditLine(index, "description", e.target.value)}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                    required
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    value={line.quantity}
                                    onChange={(e) => updateEditLine(index, "quantity", parseFloat(e.target.value) || 0)}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right"
                                    step="0.01"
                                    min="0"
                                    required
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    value={line.rate}
                                    onChange={(e) => updateEditLine(index, "rate", parseFloat(e.target.value) || 0)}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right"
                                    step="0.01"
                                    min="0"
                                    required
                                  />
                                </td>
                                <td className="px-4 py-3 text-right font-medium">
                                  {formatCurrency(line.amount)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {editLines.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeEditLine(index)}
                                      className="text-red-600 hover:text-red-800 text-sm"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50">
                              <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                                Total:
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-lg">
                                {formatCurrency(editLines.reduce((sum, line) => sum + line.amount, 0))}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <button
                        type="button"
                        onClick={addEditLine}
                        className="mt-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-600"
                      >
                        + Add Line Item
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Remarks (Admin Only) */}
                  {hasAccess && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Remarks
                      </label>
                      <textarea
                        value={editRemarks}
                        onChange={(e) => setEditRemarks(e.target.value)}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Admin notes or remarks..."
                      />
                    </div>
                  )}

                  {/* Payment Method */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Payment Method</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Bank</label>
                        <input
                          type="text"
                          value={editPaymentBank}
                          onChange={(e) => setEditPaymentBank(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="Bank Name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Account Name</label>
                        <input
                          type="text"
                          value={editPaymentAccountName}
                          onChange={(e) => setEditPaymentAccountName(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="Account Name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Account Number</label>
                        <input
                          type="text"
                          value={editPaymentAccountNumber}
                          onChange={(e) => setEditPaymentAccountNumber(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="Account Number"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prepared By */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Prepared By</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Name</label>
                        <input
                          type="text"
                          value={editPreparedByName}
                          onChange={(e) => setEditPreparedByName(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="Prepared By Name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Title</label>
                        <input
                          type="text"
                          value={editPreparedByTitle}
                          onChange={(e) => setEditPreparedByTitle(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="Title/Position"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingInvoice(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingInvoice}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {savingInvoice ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Status Change Confirmation Modal */}
      {showStatusConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto p-4 sm:p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Status Change</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to update this invoice status to <strong>{pendingStatus}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowStatusConfirm(false);
                  setPendingStatus("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={savingInvoice}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {savingInvoice ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Confirmation Modal */}
      {showEditConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto p-4 sm:p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Invoice Update</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to update this invoice?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelEditInvoice}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEditInvoice}
                disabled={savingInvoice}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {savingInvoice ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
