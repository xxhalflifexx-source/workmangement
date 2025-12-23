"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  listQuotations, 
  createQuotation, 
  updateQuotation, 
  deleteQuotation, 
  getNextQuotationNumber,
  filterQuotations,
  updateQuotationStatus,
  convertQuotationToInvoice,
  getJobsForQuotation,
  getCustomersForQuotation,
} from "./actions";
import { getCompanySettingsForInvoice } from "../jobs/invoice-actions";
import { generateDocumentPDF, DocumentPDFData } from "@/lib/pdf-generator";
import { formatDateShort, formatDateInput, todayCentralISO } from "@/lib/date-utils";
import MobileModal from "@/components/MobileModal";

interface QuotationLine {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Quotation {
  id: string;
  quotationNumber: string | null;
  issueDate: string | Date;
  validUntil: string | Date | null;
  total: number;
  status: string;
  customer: { id: string; name: string; company?: string; phone?: string; email?: string } | null;
  job: { title: string | null; id?: string; jobNumber?: string } | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
  notes: string | null;
  customerName: string | null;
  customerAddress: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  shippingFee: number;
  paymentBank: string | null;
  paymentAccountName: string | null;
  paymentAccountNumber: string | null;
  preparedByName: string | null;
  preparedByTitle: string | null;
  lines: QuotationLine[];
}

type SortField = "quotationNumber" | "issueDate" | "total" | "status" | "customer" | "createdAt";
type SortDirection = "asc" | "desc";

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 border-gray-300",
  SENT: "bg-blue-100 text-blue-800 border-blue-300",
  ACCEPTED: "bg-green-100 text-green-800 border-green-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
  EXPIRED: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CONVERTED: "bg-purple-100 text-purple-800 border-purple-300",
};

export default function QuotationsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = (session?.user as any)?.role;
  const hasAccess = userRole === "ADMIN" || userRole === "MANAGER";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [filteredQuotations, setFilteredQuotations] = useState<Quotation[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Create Quotation states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [quotationLines, setQuotationLines] = useState<QuotationLine[]>([
    { description: "", quantity: 1, rate: 0, amount: 0 },
  ]);
  const [quotationIssueDate, setQuotationIssueDate] = useState(todayCentralISO());
  const [quotationValidUntil, setQuotationValidUntil] = useState("");
  const [quotationNotes, setQuotationNotes] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  const [creatingQuotation, setCreatingQuotation] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [quotationNumber, setQuotationNumber] = useState("");

  // Editable customer fields
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

  // Edit Quotation states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [editLines, setEditLines] = useState<QuotationLine[]>([]);
  const [editValidUntil, setEditValidUntil] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editShippingFee, setEditShippingFee] = useState(0);
  const [editPaymentBank, setEditPaymentBank] = useState("");
  const [editPaymentAccountName, setEditPaymentAccountName] = useState("");
  const [editPaymentAccountNumber, setEditPaymentAccountNumber] = useState("");
  const [editPreparedByName, setEditPreparedByName] = useState("");
  const [editPreparedByTitle, setEditPreparedByTitle] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerEmail, setEditCustomerEmail] = useState("");
  const [savingQuotation, setSavingQuotation] = useState(false);

  // Convert to invoice state
  const [converting, setConverting] = useState(false);

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

  const loadQuotations = async () => {
    setLoading(true);
    setError(undefined);

    try {
      const res = await listQuotations();
      if (!res.ok) {
        setError(res.error || "Failed to load quotations");
        setQuotations([]);
        setFilteredQuotations([]);
        return;
      }
      if (res.ok && res.quotations) {
        setQuotations(res.quotations as Quotation[]);
        setFilteredQuotations(res.quotations as Quotation[]);
      }
    } catch (err: any) {
      console.error("Load quotations error:", err);
      setError(err?.message || "Failed to load quotations");
      setQuotations([]);
      setFilteredQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, []);

  // Preload next quotation number when modal opens
  useEffect(() => {
    const preloadQuotationNumber = async () => {
      try {
        const next = await getNextQuotationNumber();
        if (next) setQuotationNumber(next);
      } catch (err) {
        console.error("Failed to preload quotation number", err);
      }
    };

    if (showCreateModal) {
      preloadQuotationNumber();
      loadJobsAndCustomers();
    }
  }, [showCreateModal]);

  const loadJobsAndCustomers = async () => {
    setLoadingJobs(true);
    try {
      const [jobsRes, customersRes] = await Promise.all([
        getJobsForQuotation(),
        getCustomersForQuotation(),
      ]);
      if (jobsRes.ok) setJobs(jobsRes.jobs || []);
      if (customersRes.ok) setCustomers(customersRes.customers || []);
    } catch (err) {
      console.error("Failed to load jobs/customers", err);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Apply filters and search
  useEffect(() => {
    let filtered = [...quotations];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((q) => 
        q.quotationNumber?.toLowerCase().includes(query) ||
        q.customer?.name?.toLowerCase().includes(query) ||
        q.customerName?.toLowerCase().includes(query) ||
        q.job?.title?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((q) => q.status === statusFilter);
    }

    // Date filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((q) => new Date(q.issueDate) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((q) => new Date(q.issueDate) <= toDate);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "quotationNumber":
          aVal = a.quotationNumber || "";
          bVal = b.quotationNumber || "";
          break;
        case "issueDate":
          aVal = new Date(a.issueDate).getTime();
          bVal = new Date(b.issueDate).getTime();
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
          aVal = a.customer?.name || a.customerName || "";
          bVal = b.customer?.name || b.customerName || "";
          break;
        case "createdAt":
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
      }
      if (sortDirection === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    setFilteredQuotations(filtered);
  }, [quotations, searchQuery, statusFilter, dateFrom, dateTo, sortField, sortDirection]);

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    return formatDateShort(date);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  // Line item handlers
  const addLine = () => {
    setQuotationLines([...quotationLines, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeLine = (index: number) => {
    if (quotationLines.length > 1) {
      setQuotationLines(quotationLines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof QuotationLine, value: string | number) => {
    const updated = [...quotationLines];
    if (field === "quantity" || field === "rate") {
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
      updated[index][field] = numValue;
      updated[index].amount = updated[index].quantity * updated[index].rate;
    } else if (field === "amount") {
      updated[index].amount = typeof value === "string" ? parseFloat(value) || 0 : value;
    } else {
      updated[index][field] = value as string;
    }
    setQuotationLines(updated);
  };

  const calculateSubtotal = () => {
    return quotationLines.reduce((sum, line) => sum + line.amount, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + (shippingFee || 0);
  };

  // Handle job selection
  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    const job = jobs.find((j) => j.id === jobId);
    if (job?.customer) {
      setSelectedCustomerId(job.customer.id);
      setEditableCustomerName(job.customer.name || "");
      setEditableCustomerAddress(job.customer.company || "");
      setEditableCustomerPhone(job.customer.phone || "");
      setEditableCustomerEmail(job.customer.email || "");
    }
  };

  // Handle customer selection (when no job is selected)
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setEditableCustomerName(customer.name || "");
      setEditableCustomerAddress(customer.company || "");
      setEditableCustomerPhone(customer.phone || "");
      setEditableCustomerEmail(customer.email || "");
    }
  };

  // Download PDF
  const handleDownloadPDF = async (quotation?: Quotation) => {
    const q = quotation || editingQuotation;
    if (!q) {
      setError("No quotation selected");
      return;
    }

    // Load company settings if not already loaded
    let settings = companySettings;
    if (!settings) {
      settings = await getCompanySettingsForInvoice();
      setCompanySettings(settings);
    }

    // Attempt to fetch logo
    let logoDataUrl: string | undefined;
    if (settings?.logoUrl) {
      try {
        const resp = await fetch(settings.logoUrl);
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
        console.error("Error loading logo:", error);
      }
    }

    const regularLines = q.lines.filter(line => 
      !line.description.toLowerCase().includes('shipping fee')
    );
    const subtotal = regularLines.reduce((sum, line) => sum + line.amount, 0);

    const pdfData: DocumentPDFData = {
      documentNumber: q.quotationNumber || "TEMP",
      documentDate: q.issueDate,
      documentType: "QUOTATION",
      validUntil: q.validUntil || undefined,
      companyName: settings?.companyName || "Company Name",
      companyAddress: settings?.address || undefined,
      companyCity: settings?.city || undefined,
      companyState: settings?.state || undefined,
      companyZipCode: settings?.zipCode || undefined,
      companyPhone: settings?.phone || undefined,
      companyEmail: settings?.email || undefined,
      logoDataUrl,
      customerName: q.customerName || q.customer?.name || "Customer",
      customerAddress: q.customerAddress || q.customer?.company || undefined,
      customerPhone: q.customerPhone || q.customer?.phone || undefined,
      customerEmail: q.customerEmail || q.customer?.email || undefined,
      lineItems: regularLines,
      subtotal,
      shippingFee: q.shippingFee || 0,
      total: q.total,
      notes: q.notes || undefined,
      paymentBank: q.paymentBank || undefined,
      paymentAccountName: q.paymentAccountName || undefined,
      paymentAccountNumber: q.paymentAccountNumber || undefined,
      preparedByName: q.preparedByName || undefined,
      preparedByTitle: q.preparedByTitle || undefined,
    };

    const pdf = generateDocumentPDF(pdfData);
    pdf.save(`${q.quotationNumber || "QUO"}-${todayCentralISO()}.pdf`);
  };

  // Create quotation
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (quotationLines.filter(l => l.description.trim()).length === 0) {
      setError("Please add at least one line item");
      return;
    }

    setCreatingQuotation(true);
    setError(undefined);

    try {
      const lines = [...quotationLines];
      if (shippingFee > 0) {
        lines.push({
          description: "Shipping Fee",
          quantity: 1,
          rate: shippingFee,
          amount: shippingFee,
        });
      }

      const formData = new FormData();
      if (selectedJobId) formData.append("jobId", selectedJobId);
      if (selectedCustomerId) formData.append("customerId", selectedCustomerId);
      formData.append("customerName", editableCustomerName);
      formData.append("customerAddress", editableCustomerAddress);
      formData.append("customerPhone", editableCustomerPhone);
      formData.append("customerEmail", editableCustomerEmail);
      formData.append("issueDate", quotationIssueDate);
      if (quotationValidUntil) formData.append("validUntil", quotationValidUntil);
      formData.append("notes", quotationNotes || "");
      formData.append("shippingFee", shippingFee.toString());
      formData.append("paymentBank", paymentBank);
      formData.append("paymentAccountName", paymentAccountName);
      formData.append("paymentAccountNumber", paymentAccountNumber);
      formData.append("preparedByName", preparedByName);
      formData.append("preparedByTitle", preparedByTitle);
      formData.append("lines", JSON.stringify(lines));

      const res = await createQuotation(formData);
      if (!res.ok) {
        setError(res.error || "Failed to create quotation");
        return;
      }

      if (res.quotation?.quotationNumber) {
        setQuotationNumber(res.quotation.quotationNumber);
      }

      // Reset form
      setShowCreateModal(false);
      resetCreateForm();
      setSuccess("Quotation created successfully");

      await loadQuotations();
    } catch (err: any) {
      setError(err?.message || "Failed to create quotation");
    } finally {
      setCreatingQuotation(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedJobId("");
    setSelectedCustomerId("");
    setQuotationLines([{ description: "", quantity: 1, rate: 0, amount: 0 }]);
    setQuotationIssueDate(todayCentralISO());
    setQuotationValidUntil("");
    setQuotationNotes("");
    setShippingFee(0);
    setEditableCustomerName("");
    setEditableCustomerAddress("");
    setEditableCustomerPhone("");
    setEditableCustomerEmail("");
    setPaymentBank("");
    setPaymentAccountName("");
    setPaymentAccountNumber("");
    setPreparedByName("");
    setPreparedByTitle("");
  };

  // Edit quotation
  const handleEditQuotation = async (quotation: Quotation) => {
    setEditingQuotation(quotation);
    
    const allLines = quotation.lines || [];
    const shippingLine = allLines.find(line => 
      line.description.toLowerCase().includes('shipping fee')
    );
    const regularLines = allLines.filter(line => 
      !line.description.toLowerCase().includes('shipping fee')
    );
    
    setEditLines(regularLines.length > 0 ? regularLines : [{ description: "", quantity: 1, rate: 0, amount: 0 }]);
    setEditShippingFee(shippingLine ? shippingLine.amount : quotation.shippingFee || 0);
    setEditValidUntil(quotation.validUntil ? formatDateInput(quotation.validUntil) : "");
    setEditNotes(quotation.notes || "");
    setEditStatus(quotation.status);
    setEditPaymentBank(quotation.paymentBank || "");
    setEditPaymentAccountName(quotation.paymentAccountName || "");
    setEditPaymentAccountNumber(quotation.paymentAccountNumber || "");
    setEditPreparedByName(quotation.preparedByName || "");
    setEditPreparedByTitle(quotation.preparedByTitle || "");
    setEditCustomerName(quotation.customerName || quotation.customer?.name || "");
    setEditCustomerAddress(quotation.customerAddress || quotation.customer?.company || "");
    setEditCustomerPhone(quotation.customerPhone || quotation.customer?.phone || "");
    setEditCustomerEmail(quotation.customerEmail || quotation.customer?.email || "");
    
    if (!companySettings) {
      const settings = await getCompanySettingsForInvoice();
      setCompanySettings(settings);
    }
    
    setShowEditModal(true);
  };

  const addEditLine = () => {
    setEditLines([...editLines, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeEditLine = (index: number) => {
    if (editLines.length > 1) {
      setEditLines(editLines.filter((_, i) => i !== index));
    }
  };

  const updateEditLine = (index: number, field: keyof QuotationLine, value: string | number) => {
    const updated = [...editLines];
    if (field === "quantity" || field === "rate") {
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
      updated[index][field] = numValue;
      updated[index].amount = updated[index].quantity * updated[index].rate;
    } else if (field === "amount") {
      updated[index].amount = typeof value === "string" ? parseFloat(value) || 0 : value;
    } else {
      updated[index][field] = value as string;
    }
    setEditLines(updated);
  };

  const calculateEditSubtotal = () => {
    return editLines.reduce((sum, line) => sum + line.amount, 0);
  };

  const calculateEditTotal = () => {
    return calculateEditSubtotal() + (editShippingFee || 0);
  };

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuotation) return;

    setSavingQuotation(true);
    setError(undefined);

    try {
      const lines = [...editLines];
      if (editShippingFee > 0) {
        lines.push({
          description: "Shipping Fee",
          quantity: 1,
          rate: editShippingFee,
          amount: editShippingFee,
        });
      }

      const formData = new FormData();
      formData.append("quotationId", editingQuotation.id);
      formData.append("customerName", editCustomerName);
      formData.append("customerAddress", editCustomerAddress);
      formData.append("customerPhone", editCustomerPhone);
      formData.append("customerEmail", editCustomerEmail);
      formData.append("issueDate", formatDateInput(editingQuotation.issueDate));
      if (editValidUntil) formData.append("validUntil", editValidUntil);
      formData.append("notes", editNotes);
      formData.append("status", editStatus);
      formData.append("shippingFee", editShippingFee.toString());
      formData.append("paymentBank", editPaymentBank);
      formData.append("paymentAccountName", editPaymentAccountName);
      formData.append("paymentAccountNumber", editPaymentAccountNumber);
      formData.append("preparedByName", editPreparedByName);
      formData.append("preparedByTitle", editPreparedByTitle);
      formData.append("lines", JSON.stringify(lines));

      const res = await updateQuotation(formData);
      if (!res.ok) {
        setError(res.error || "Failed to update quotation");
        return;
      }

      setShowEditModal(false);
      setEditingQuotation(null);
      setSuccess("Quotation updated successfully");
      await loadQuotations();
    } catch (err: any) {
      setError(err?.message || "Failed to update quotation");
    } finally {
      setSavingQuotation(false);
    }
  };

  // Convert to invoice
  const handleConvertToInvoice = async (quotation: Quotation) => {
    if (!confirm("Are you sure you want to convert this quotation to an invoice? This action cannot be undone.")) {
      return;
    }

    setConverting(true);
    setError(undefined);

    try {
      const res = await convertQuotationToInvoice(quotation.id);
      if (!res.ok) {
        setError(res.error || "Failed to convert quotation");
        return;
      }

      setSuccess(`Quotation converted to Invoice ${res.invoice?.invoiceNumber}`);
      setShowDetails(false);
      setSelectedQuotation(null);
      await loadQuotations();
    } catch (err: any) {
      setError(err?.message || "Failed to convert quotation");
    } finally {
      setConverting(false);
    }
  };

  // Delete quotation
  const handleDeleteQuotation = async (id: string) => {
    if (!confirm("Are you sure you want to delete this quotation? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await deleteQuotation(id);
      if (!res.ok) {
        setError(res.error || "Failed to delete quotation");
        return;
      }

      setSuccess("Quotation deleted successfully");
      setShowDetails(false);
      setSelectedQuotation(null);
      await loadQuotations();
    } catch (err: any) {
      setError(err?.message || "Failed to delete quotation");
    }
  };

  // Clear messages after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(undefined), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(undefined), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to view this page.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black border-b-2 border-[#001f3f] shadow-lg sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/dashboard"
                className="text-white hover:text-gray-300 transition-colors p-2"
              >
                ← Back
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Quotations</h1>
                <p className="text-sm text-gray-400 hidden sm:block">Manage your quotations</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base min-h-[44px]"
            >
              + Create Quotation
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Search quotations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
              <option value="CONVERTED">Converted</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
              placeholder="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
              placeholder="To date"
            />
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
                setDateFrom("");
                setDateTo("");
              }}
              className="border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 min-h-[44px]"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Quotations Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-gray-500">Loading quotations...</div>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-8 text-center">
            <p className="text-gray-600">No quotations found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-indigo-600 to-blue-600">
                  <tr>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-indigo-700"
                      onClick={() => handleSort("quotationNumber")}
                    >
                      Quotation # {getSortIcon("quotationNumber")}
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-indigo-700"
                      onClick={() => handleSort("customer")}
                    >
                      Customer {getSortIcon("customer")}
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-indigo-700"
                      onClick={() => handleSort("issueDate")}
                    >
                      Issue Date {getSortIcon("issueDate")}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Valid Until
                    </th>
                    <th 
                      className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-indigo-700"
                      onClick={() => handleSort("total")}
                    >
                      Total {getSortIcon("total")}
                    </th>
                    <th 
                      className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-indigo-700"
                      onClick={() => handleSort("status")}
                    >
                      Status {getSortIcon("status")}
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredQuotations.map((quotation) => (
                    <tr 
                      key={quotation.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedQuotation(quotation);
                        setShowDetails(true);
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {quotation.quotationNumber || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {quotation.customer?.name || quotation.customerName || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(quotation.issueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(quotation.validUntil)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(quotation.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[quotation.status] || statusColors.DRAFT}`}>
                          {quotation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEditQuotation(quotation)}
                            className="px-3 py-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-all text-xs font-medium min-h-[44px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(quotation)}
                            className="px-3 py-1 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-md transition-all text-xs font-medium min-h-[44px]"
                          >
                            PDF
                          </button>
                          {quotation.status !== "CONVERTED" && (
                            <button
                              onClick={() => handleConvertToInvoice(quotation)}
                              disabled={converting}
                              className="px-3 py-1 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-md transition-all text-xs font-medium min-h-[44px] disabled:opacity-50"
                            >
                              → Invoice
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteQuotation(quotation.id)}
                            className="px-3 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-all text-xs font-medium min-h-[44px]"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Quotation Modal */}
      <MobileModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetCreateForm();
        }}
        title="Create Quotation"
      >
        <form onSubmit={handleCreateQuotation} className="space-y-6">
          {/* Quotation Number Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              <strong>Quotation Number:</strong> {quotationNumber || "Loading..."}
            </p>
          </div>

          {/* Job Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link to Job (Optional)</label>
            <select
              value={selectedJobId}
              onChange={(e) => handleJobSelect(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[44px]"
              disabled={loadingJobs}
            >
              <option value="">No job linked</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.jobNumber ? `#${job.jobNumber} - ` : ""}{job.title} {job.customer?.name ? `(${job.customer.name})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Selection (if no job) */}
          {!selectedJobId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[44px]"
              >
                <option value="">Select a customer or enter manually</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-700 text-sm">Customer Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Customer Name *"
                value={editableCustomerName}
                onChange={(e) => setEditableCustomerName(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
                required
              />
              <input
                type="text"
                placeholder="Address"
                value={editableCustomerAddress}
                onChange={(e) => setEditableCustomerAddress(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
              />
              <input
                type="text"
                placeholder="Phone"
                value={editableCustomerPhone}
                onChange={(e) => setEditableCustomerPhone(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
              />
              <input
                type="email"
                placeholder="Email"
                value={editableCustomerEmail}
                onChange={(e) => setEditableCustomerEmail(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date *</label>
              <input
                type="date"
                value={quotationIssueDate}
                onChange={(e) => setQuotationIssueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[44px]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
              <input
                type="date"
                value={quotationValidUntil}
                onChange={(e) => setQuotationValidUntil(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[44px]"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Line Items</label>
              <button
                type="button"
                onClick={addLine}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-3">
              {quotationLines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updateLine(index, "description", e.target.value)}
                    className="col-span-5 border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={line.quantity || ""}
                    onChange={(e) => updateLine(index, "quantity", e.target.value)}
                    className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                    min="0"
                    step="1"
                  />
                  <input
                    type="number"
                    placeholder="Rate"
                    value={line.rate || ""}
                    onChange={(e) => updateLine(index, "rate", e.target.value)}
                    className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                    min="0"
                    step="0.01"
                  />
                  <div className="col-span-2 text-right font-medium text-gray-700">
                    {formatCurrency(line.amount)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="col-span-1 text-red-500 hover:text-red-700"
                    disabled={quotationLines.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Fee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Fee</label>
            <input
              type="number"
              value={shippingFee || ""}
              onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[44px]"
              min="0"
              step="0.01"
            />
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Shipping:</span>
              <span className="font-medium">{formatCurrency(shippingFee)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>{formatCurrency(calculateTotal())}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Terms</label>
            <textarea
              value={quotationNotes}
              onChange={(e) => setQuotationNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[100px]"
              placeholder="Payment terms, conditions, etc."
            />
          </div>

          {/* Payment Method */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-700 text-sm">Payment Method</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Bank Name"
                value={paymentBank}
                onChange={(e) => setPaymentBank(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
              />
              <input
                type="text"
                placeholder="Account Name"
                value={paymentAccountName}
                onChange={(e) => setPaymentAccountName(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
              />
              <input
                type="text"
                placeholder="Account Number"
                value={paymentAccountNumber}
                onChange={(e) => setPaymentAccountNumber(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
              />
            </div>
          </div>

          {/* Prepared By */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-700 text-sm">Prepared By</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={preparedByName}
                onChange={(e) => setPreparedByName(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
              />
              <input
                type="text"
                placeholder="Title/Position"
                value={preparedByTitle}
                onChange={(e) => setPreparedByTitle(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                resetCreateForm();
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingQuotation}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 min-h-[44px]"
            >
              {creatingQuotation ? "Creating..." : "Create Quotation"}
            </button>
          </div>
        </form>
      </MobileModal>

      {/* Edit Quotation Modal */}
      <MobileModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingQuotation(null);
        }}
        title={`Edit Quotation ${editingQuotation?.quotationNumber || ""}`}
      >
        {editingQuotation && (
          <form onSubmit={handleSaveQuotation} className="space-y-6">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[44px]"
              >
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            {/* Customer Details */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-700 text-sm">Customer Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={editCustomerAddress}
                  onChange={(e) => setEditCustomerAddress(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
                />
                <input
                  type="text"
                  placeholder="Phone"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={editCustomerEmail}
                  onChange={(e) => setEditCustomerEmail(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 min-h-[44px]"
                />
              </div>
            </div>

            {/* Valid Until */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
              <input
                type="date"
                value={editValidUntil}
                onChange={(e) => setEditValidUntil(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[44px]"
              />
            </div>

            {/* Line Items */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Line Items</label>
                <button
                  type="button"
                  onClick={addEditLine}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-3">
                {editLines.map((line, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateEditLine(index, "description", e.target.value)}
                      className="col-span-5 border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={line.quantity || ""}
                      onChange={(e) => updateEditLine(index, "quantity", e.target.value)}
                      className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                      min="0"
                      step="1"
                    />
                    <input
                      type="number"
                      placeholder="Rate"
                      value={line.rate || ""}
                      onChange={(e) => updateEditLine(index, "rate", e.target.value)}
                      className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                      min="0"
                      step="0.01"
                    />
                    <div className="col-span-2 text-right font-medium text-gray-700">
                      {formatCurrency(line.amount)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEditLine(index)}
                      className="col-span-1 text-red-500 hover:text-red-700"
                      disabled={editLines.length === 1}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Fee</label>
              <input
                type="number"
                value={editShippingFee || ""}
                onChange={(e) => setEditShippingFee(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[44px]"
                min="0"
                step="0.01"
              />
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(calculateEditSubtotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping:</span>
                <span className="font-medium">{formatCurrency(editShippingFee)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(calculateEditTotal())}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Terms</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[100px]"
              />
            </div>

            {/* Payment Method */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-700 text-sm">Payment Method</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Bank Name"
                  value={editPaymentBank}
                  onChange={(e) => setEditPaymentBank(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                />
                <input
                  type="text"
                  placeholder="Account Name"
                  value={editPaymentAccountName}
                  onChange={(e) => setEditPaymentAccountName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                />
                <input
                  type="text"
                  placeholder="Account Number"
                  value={editPaymentAccountNumber}
                  onChange={(e) => setEditPaymentAccountNumber(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                />
              </div>
            </div>

            {/* Prepared By */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-700 text-sm">Prepared By</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Name"
                  value={editPreparedByName}
                  onChange={(e) => setEditPreparedByName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                />
                <input
                  type="text"
                  placeholder="Title/Position"
                  value={editPreparedByTitle}
                  onChange={(e) => setEditPreparedByTitle(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 min-h-[44px]"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => handleDownloadPDF()}
                className="px-4 py-3 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 min-h-[44px]"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingQuotation(null);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingQuotation}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 min-h-[44px]"
              >
                {savingQuotation ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </MobileModal>

      {/* Quotation Details Modal */}
      <MobileModal
        isOpen={showDetails && selectedQuotation !== null}
        onClose={() => {
          setShowDetails(false);
          setSelectedQuotation(null);
        }}
        title="Quotation Details"
      >
        {selectedQuotation && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">Quotation Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Number</span>
                    <span className="font-semibold">{selectedQuotation.quotationNumber || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[selectedQuotation.status] || statusColors.DRAFT}`}>
                      {selectedQuotation.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Issue Date</span>
                    <span className="font-semibold">{formatDate(selectedQuotation.issueDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valid Until</span>
                    <span className="font-semibold">{formatDate(selectedQuotation.validUntil)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">Customer & Job</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer</span>
                    <span className="font-semibold">{selectedQuotation.customer?.name || selectedQuotation.customerName || "—"}</span>
                  </div>
                  {selectedQuotation.job && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Job</span>
                        <span className="font-semibold">{selectedQuotation.job.jobNumber ? `#${selectedQuotation.job.jobNumber}` : ""}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Job Title</span>
                        <span className="font-semibold">{selectedQuotation.job.title || "—"}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-blue-700 font-medium">Total Amount</span>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(selectedQuotation.total)}</span>
              </div>
            </div>

            {/* Line Items */}
            {selectedQuotation.lines && selectedQuotation.lines.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Line Items</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedQuotation.lines.map((line, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-sm text-gray-900">{line.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 text-right">{line.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 text-right">{formatCurrency(line.rate)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(line.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedQuotation.notes && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">Notes</h3>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedQuotation.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <button
                onClick={() => handleDownloadPDF(selectedQuotation)}
                className="flex-1 px-4 py-3 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 min-h-[44px]"
              >
                Download PDF
              </button>
              <button
                onClick={() => {
                  setShowDetails(false);
                  handleEditQuotation(selectedQuotation);
                }}
                className="flex-1 px-4 py-3 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 min-h-[44px]"
              >
                Edit
              </button>
              {selectedQuotation.status !== "CONVERTED" && (
                <button
                  onClick={() => handleConvertToInvoice(selectedQuotation)}
                  disabled={converting}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 min-h-[44px]"
                >
                  {converting ? "Converting..." : "Convert to Invoice"}
                </button>
              )}
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedQuotation(null);
                }}
                className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </MobileModal>
    </main>
  );
}

