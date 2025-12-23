"use client";

import React, { useEffect, useState, useRef, Suspense, useMemo, useCallback } from "react";
import { getJobs, getAllUsers, createJob, updateJob, deleteJob, getJobActivities, addJobActivity, getAllCustomers, createCustomer, updateCustomer, saveJobPhotos, submitJobPhotosToQC, getJobPhotos, removeJobPhoto as removeJobPhotoFromDB, getJobExpenses, addJobExpense, deleteJobExpense, exportJobsToCSV } from "./actions";
import { createMaterialRequest, getJobMaterialRequests } from "../material-requests/actions";
import { getCompanySettingsForInvoice } from "./invoice-actions";
import { createQuotation, updateQuotation, getQuotationsByJobId, getQuotation } from "../quotations/actions";
import { generateQuotationPDF, QuotationPDFData } from "@/lib/quotation-pdf-generator";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import PhotoViewerModal from "../qc/PhotoViewerModal";
import JobFilters from "./JobFilters";
import JobRow from "./JobRow";
import ReceiptScanner from "@/components/ReceiptScanner";
import { formatDateShort, formatDateTime, formatDateInput, todayCentralISO, nowInCentral, centralToUTC } from "@/lib/date-utils";
import MobileCardView from "@/components/MobileCardView";
import MobileModal from "@/components/MobileModal";

interface Job {
  id: string;
  jobNumber: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  pricingType: string;
  estimatedPrice: number | null;
  finalPrice: number | null;
  estimatedHours: number | null;
  dueDate: string | null;
  assignee: { id: string; name: string; email: string } | null;
  assignments?: Array<{
    id: string;
    user: { id: string; name: string | null; email: string | null; role: string };
  }>;
  creator: { name: string };
  customer: { id: string; name: string; phone: string | null; email: string | null; company: string | null } | null;
  createdAt: string;
  timeEntries?: Array<{
    id: string;
    clockIn: string;
    clockOut: string | null;
    durationHours: number | null;
    user: {
      id: string;
      name: string | null;
    } | null;
  }>;
  activities?: Array<{
    id: string;
    images: string | null;
    createdAt: string;
  }>;
  expenses?: Array<{
    id: string;
    amount: number;
    category: string;
    description: string;
    quantity: number;
    unit: string | null;
    notes: string | null;
    expenseDate: string;
    createdAt: string;
    user: {
      name: string | null;
    };
  }>;
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
}

interface JobActivity {
  id: string;
  type: string;
  timeEntryId: string | null;
  notes: string | null;
  images: string | null;
  createdAt: Date;
  user: {
    name: string | null;
    email: string | null;
  };
}

interface MaterialRequest {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  description: string | null;
  priority: string;
  status: string;
  requestedDate: string;
  fulfilledDate: string | null;
  notes: string | null;
  user: {
    name: string | null;
    email: string | null;
  };
}

function JobsPageContent() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = (session?.user as any)?.role;
  const canManage = userRole === "MANAGER" || userRole === "ADMIN";
  const router = useRouter();
  const searchParams = useSearchParams();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  
  // Track initial load and prevent unnecessary reloads on tab switch
  const hasInitiallyLoaded = useRef(false);
  const lastSessionId = useRef<string | null>(null);
  
  // Pagination state - load from localStorage if available
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jobs_currentPage");
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filter state - load from localStorage if available
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jobs_searchQuery");
      return saved || "";
    }
    return "";
  });
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jobs_filterStatus");
      return saved || "ALL";
    }
    return "ALL";
  });
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterCustomer, setFilterCustomer] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jobs_filterCustomer");
      return saved || "";
    }
    return "";
  });
  const [filterWorker, setFilterWorker] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jobs_filterWorker");
      return saved || "";
    }
    return "";
  });
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jobs_filterDateFrom");
      return saved || "";
    }
    return "";
  });
  const [filterDateTo, setFilterDateTo] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jobs_filterDateTo");
      return saved || "";
    }
    return "";
  });
  
  // Initialize search params after component mounts
  const [searchInitialized, setSearchInitialized] = useState(false);
  
  // Track if filters have been applied to prevent unnecessary reloads
  const filtersInitialized = useRef(false);
  
  // Debounce search query and save to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (typeof window !== "undefined") {
        localStorage.setItem("jobs_searchQuery", searchQuery);
      }
      setCurrentPage(1); // Reset to first page on search
      if (typeof window !== "undefined") {
        localStorage.setItem("jobs_currentPage", "1");
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Save filter changes to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && filtersInitialized.current) {
      localStorage.setItem("jobs_filterStatus", filterStatus);
    }
  }, [filterStatus]);
  
  useEffect(() => {
    if (typeof window !== "undefined" && filtersInitialized.current) {
      localStorage.setItem("jobs_filterCustomer", filterCustomer);
    }
  }, [filterCustomer]);
  
  useEffect(() => {
    if (typeof window !== "undefined" && filtersInitialized.current) {
      localStorage.setItem("jobs_filterWorker", filterWorker);
    }
  }, [filterWorker]);
  
  useEffect(() => {
    if (typeof window !== "undefined" && filtersInitialized.current) {
      localStorage.setItem("jobs_filterDateFrom", filterDateFrom);
    }
  }, [filterDateFrom]);
  
  useEffect(() => {
    if (typeof window !== "undefined" && filtersInitialized.current) {
      localStorage.setItem("jobs_filterDateTo", filterDateTo);
    }
  }, [filterDateTo]);
  
  useEffect(() => {
    if (typeof window !== "undefined" && filtersInitialized.current) {
      localStorage.setItem("jobs_currentPage", currentPage.toString());
    }
  }, [currentPage]);
  
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerCompany, setNewCustomerCompany] = useState("");
  
  // Editable customer fields for editing existing customers
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [editableCustomerName, setEditableCustomerName] = useState("");
  const [editableCustomerPhone, setEditableCustomerPhone] = useState("");
  const [editableCustomerEmail, setEditableCustomerEmail] = useState("");
  const [editableCustomerCompany, setEditableCustomerCompany] = useState("");
  const [showCustomerUpdateConfirm, setShowCustomerUpdateConfirm] = useState(false);
  const [pendingCustomerUpdate, setPendingCustomerUpdate] = useState<{customerId: string, formData: FormData} | null>(null);
  
  // Multiple worker assignments - array of selected user IDs
  const [assignedWorkerIds, setAssignedWorkerIds] = useState<string[]>([]);
  
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedJobForActivity, setSelectedJobForActivity] = useState<Job | null>(null);
  const [jobActivities, setJobActivities] = useState<JobActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // Expenses state (now part of unified modal)
  const [jobExpenses, setJobExpenses] = useState<any[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState("Materials");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseQuantity, setExpenseQuantity] = useState("1");
  const [expenseUnit, setExpenseUnit] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseReceiptUrl, setExpenseReceiptUrl] = useState<string | null>(null);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  
  // Photo upload states per job
  const [jobPhotoFiles, setJobPhotoFiles] = useState<Record<string, File[]>>({});
  const [savingPhotos, setSavingPhotos] = useState<Record<string, boolean>>({});
  const [jobExistingPhotos, setJobExistingPhotos] = useState<Record<string, Array<{ id: string; url: string; activityId: string }>>>({});
  const [removingPhotos, setRemovingPhotos] = useState<Record<string, boolean>>({});
  
  // Photo viewer modal state
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  
  const [showMaterialsAndExpensesModal, setShowMaterialsAndExpensesModal] = useState(false);
  const [selectedJobForMaterialsAndExpenses, setSelectedJobForMaterialsAndExpenses] = useState<Job | null>(null);
  const [jobMaterialRequests, setJobMaterialRequests] = useState<MaterialRequest[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [activeTab, setActiveTab] = useState<"materials" | "expenses" | "history">("materials");
  
  const [materialItemName, setMaterialItemName] = useState("");
  const [materialQuantity, setMaterialQuantity] = useState(1);
  const [materialUnit, setMaterialUnit] = useState("pcs");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialPriority, setMaterialPriority] = useState("MEDIUM");
  const [materialNotes, setMaterialNotes] = useState("");
  const [submittingMaterial, setSubmittingMaterial] = useState(false);
  
  // Estimated duration for jobs (stored in hours, can be entered as hours/days/weeks/months)
  const [estimatedDurationValue, setEstimatedDurationValue] = useState<string>("");
  const [estimatedDurationUnit, setEstimatedDurationUnit] = useState<"HOURS" | "DAYS" | "WEEKS" | "MONTHS">("HOURS");
  
  // Quotation states
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [selectedJobForQuotation, setSelectedJobForQuotation] = useState<Job | null>(null);
  const [currentQuotationId, setCurrentQuotationId] = useState<string | null>(null); // For editing existing quotations
  const [quotationDate, setQuotationDate] = useState(todayCentralISO());
  const [quotationValidUntil, setQuotationValidUntil] = useState("");
  const [quotationLineItems, setQuotationLineItems] = useState<any[]>([]);
  const [quotationNotes, setQuotationNotes] = useState("");
  const [quotationShippingFee, setQuotationShippingFee] = useState(0);
  const [quotationPaymentBank, setQuotationPaymentBank] = useState("");
  const [quotationPaymentAccountName, setQuotationPaymentAccountName] = useState("");
  const [quotationPaymentAccountNumber, setQuotationPaymentAccountNumber] = useState("");
  const [quotationPreparedByName, setQuotationPreparedByName] = useState("");
  const [quotationPreparedByTitle, setQuotationPreparedByTitle] = useState("");
  const [quotationCustomerName, setQuotationCustomerName] = useState("");
  const [quotationCustomerAddress, setQuotationCustomerAddress] = useState("");
  const [quotationCustomerPhone, setQuotationCustomerPhone] = useState("");
  const [quotationCustomerEmail, setQuotationCustomerEmail] = useState("");
  const [savingQuotation, setSavingQuotation] = useState(false);
  const [autoSavingQuotation, setAutoSavingQuotation] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const quotationRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize search params from URL
  useEffect(() => {
    if (searchParams && !searchInitialized) {
      setSearchQuery(searchParams.get("q") || "");
      setFilterStatus(searchParams.get("status") || "ALL");
      setSearchInitialized(true);
    }
  }, [searchParams, searchInitialized]);

  // Define loadData function first (before useEffect hooks that use it)
  const loadData = useCallback(async (page?: number) => {
    const targetPage = page !== undefined ? page : currentPage;
    // Ensure we have a session before loading
    if (!session?.user) {
      setLoading(false);
      setError("Please log in to view jobs");
      return;
    }

    // Calculate canManage from current session state
    const currentCanManage = (session?.user as any)?.role === "MANAGER" || (session?.user as any)?.role === "ADMIN";
    
    setLoading(true);
    setError(undefined);
    
    try {
      const startTime = Date.now();
      
      // Build filter parameters
      const filterParams: any = {
        page: targetPage,
        pageSize,
      };
      
      if (debouncedSearchQuery) {
        filterParams.search = debouncedSearchQuery;
      }
      
      if (filterStatus && filterStatus !== "ALL") {
        filterParams.status = filterStatus;
      }
      
      if (filterCustomer) {
        filterParams.customerId = filterCustomer;
      }
      
      if (filterWorker) {
        filterParams.workerId = filterWorker;
      }
      
      if (filterDateFrom) {
        filterParams.dateFrom = filterDateFrom;
      }
      
      if (filterDateTo) {
        filterParams.dateTo = filterDateTo;
      }
      
      const [jobsRes, usersRes, customersRes] = await Promise.all([
        getJobs(filterParams),
        currentCanManage ? getAllUsers() : Promise.resolve({ ok: true, users: [] }),
        currentCanManage ? getAllCustomers() : Promise.resolve({ ok: true, customers: [] }),
      ]);

      const duration = Date.now() - startTime;
      console.log(`[loadData] API calls completed in ${duration}ms`);

      if (jobsRes.ok) {
        const jobsData = jobsRes.jobs as any;
        const pagination = (jobsRes as any).pagination;
        
        setJobs(jobsData || []);
        if (pagination) {
          setTotalCount(pagination.totalCount || 0);
          setTotalPages(pagination.totalPages || 0);
          // Update current page if it was explicitly provided
          if (page !== undefined) {
            setCurrentPage(targetPage);
          }
        }

        // Extract photos from activities for each job (async, non-blocking)
        setTimeout(() => {
          const photosMap: Record<string, Array<{ id: string; url: string; activityId: string }>> = {};
          (jobsData || []).forEach((job: any) => {
            if (job.activities) {
              const jobPhotos: Array<{ id: string; url: string; activityId: string }> = [];
              job.activities.forEach((activity: any) => {
                if (activity.images) {
                  try {
                    const parsed = JSON.parse(activity.images);
                    if (Array.isArray(parsed)) {
                      parsed.forEach((url: string) => {
                        jobPhotos.push({
                          id: `${activity.id}-${url}`,
                          url,
                          activityId: activity.id,
                        });
                      });
                    }
                  } catch {
                    if (typeof activity.images === "string") {
                      jobPhotos.push({
                        id: `${activity.id}-${activity.images}`,
                        url: activity.images,
                        activityId: activity.id,
                      });
                    }
                  }
                }
              });
              photosMap[job.id] = jobPhotos;
            }
          });
          setJobExistingPhotos(photosMap);
        }, 0);
      } else {
        setError(jobsRes.error || "Failed to load jobs");
        setJobs([]);
        setTotalCount(0);
        setTotalPages(0);
      }

      if (usersRes.ok) {
        setUsers(usersRes.users as any || []);
      }

      if (customersRes.ok) {
        setCustomers(customersRes.customers as any || []);
      }
    } catch (err: any) {
      console.error("[loadData] Exception caught:", err);
      setError(err?.message || "Failed to load jobs. Please try refreshing the page.");
      setJobs([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [session, currentPage, pageSize, debouncedSearchQuery, filterStatus, filterCustomer, filterWorker, filterDateFrom, filterDateTo]);

  // Load data when session is ready (only on initial load or actual session change)
  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }
    
    if (!session?.user) {
      setLoading(false);
      setError("Please log in to view jobs");
      hasInitiallyLoaded.current = false;
      lastSessionId.current = null;
      return;
    }
    
    const currentSessionId = (session.user as any)?.id;
    
    // Only reload if:
    // 1. This is the initial load (hasInitiallyLoaded is false)
    // 2. The session user ID actually changed (different user logged in)
    // Don't reload if just re-validating the same session
    if (!hasInitiallyLoaded.current || lastSessionId.current !== currentSessionId) {
      hasInitiallyLoaded.current = true;
      lastSessionId.current = currentSessionId;
      filtersInitialized.current = false; // Reset filter initialization on new session
      loadData();
    }
  }, [sessionStatus, session?.user, loadData]);
  
  // Reload data when filters change (reset to page 1)
  // Only reload if filters have been initialized (not on initial mount)
  useEffect(() => {
    if (sessionStatus === "loading" || !session?.user || !hasInitiallyLoaded.current) return;
    
    // Mark filters as initialized after first load
    if (!filtersInitialized.current) {
      filtersInitialized.current = true;
      return;
    }
    
    // Reset to first page and reload when filters change
    setCurrentPage(1);
    if (typeof window !== "undefined") {
      localStorage.setItem("jobs_currentPage", "1");
    }
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterCustomer, filterWorker, filterDateFrom, filterDateTo, debouncedSearchQuery]);

  // When editing a job, pre-fill estimated duration controls based on stored estimatedHours
  useEffect(() => {
    if (!editingJob || editingJob.estimatedHours == null) {
      setEstimatedDurationValue("");
      setEstimatedDurationUnit("HOURS");
      return;
    }

    const hours = editingJob.estimatedHours;

    // Prefer the largest whole unit that divides evenly, otherwise fall back to hours
    const HOURS_PER_DAY = 8;
    const HOURS_PER_WEEK = HOURS_PER_DAY * 5;
    const HOURS_PER_MONTH = HOURS_PER_WEEK * 4;

    if (hours % HOURS_PER_MONTH === 0) {
      setEstimatedDurationValue(String(hours / HOURS_PER_MONTH));
      setEstimatedDurationUnit("MONTHS");
    } else if (hours % HOURS_PER_WEEK === 0) {
      setEstimatedDurationValue(String(hours / HOURS_PER_WEEK));
      setEstimatedDurationUnit("WEEKS");
    } else if (hours % HOURS_PER_DAY === 0) {
      setEstimatedDurationValue(String(hours / HOURS_PER_DAY));
      setEstimatedDurationUnit("DAYS");
    } else {
      setEstimatedDurationValue(String(hours));
      setEstimatedDurationUnit("HOURS");
    }
  }, [editingJob]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const formData = new FormData(e.currentTarget);

    // Convert estimated duration (value + unit) into hours for backend
    const rawDuration = formData.get("estimatedDurationValue") as string;
    const rawUnit = (formData.get("estimatedDurationUnit") as string) || "HOURS";

    if (rawDuration) {
      const value = parseFloat(rawDuration);
      if (!Number.isNaN(value) && value > 0) {
        const HOURS_PER_DAY = 8;
        const HOURS_PER_WEEK = HOURS_PER_DAY * 5;
        const HOURS_PER_MONTH = HOURS_PER_WEEK * 4;

        let hours = value;
        switch (rawUnit) {
          case "DAYS":
            hours = value * HOURS_PER_DAY;
            break;
          case "WEEKS":
            hours = value * HOURS_PER_WEEK;
            break;
          case "MONTHS":
            hours = value * HOURS_PER_MONTH;
            break;
          case "HOURS":
          default:
            hours = value;
            break;
        }

        formData.set("estimatedHours", hours.toString());
      }
    }

    // Ensure customerId is set in formData if a customer is selected
    if (selectedCustomerId) {
      formData.set("customerId", selectedCustomerId);
    }

    // Add assigned workers to formData (filter out empty strings)
    assignedWorkerIds.forEach((workerId) => {
      if (workerId && workerId.trim() !== "") {
        formData.append("assignedUsers", workerId);
      }
    });

    // Handle customer update if editing existing customer
    if (selectedCustomerId && canManage) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer) {
        // Check if customer fields have been modified
        const hasChanges = 
          editableCustomerName !== customer.name ||
          editableCustomerPhone !== (customer.phone || "") ||
          editableCustomerEmail !== (customer.email || "") ||
          editableCustomerCompany !== (customer.company || "");

        if (hasChanges) {
          // Validate customer name
          if (!editableCustomerName || editableCustomerName.trim() === "") {
            setError("Customer name is required");
            return;
          }

          // Prepare customer update form data
          const customerFormData = new FormData();
          customerFormData.append("name", editableCustomerName.trim());
          customerFormData.append("phone", editableCustomerPhone.trim());
          customerFormData.append("email", editableCustomerEmail.trim());
          customerFormData.append("company", editableCustomerCompany.trim());

          // Show confirmation modal
          setPendingCustomerUpdate({ customerId: selectedCustomerId, formData: customerFormData });
          setShowCustomerUpdateConfirm(true);
          return; // Wait for confirmation before proceeding
        }
      }
    }

    // Proceed with job creation/update
    const res = editingJob
      ? await updateJob(editingJob.id, formData)
      : await createJob(formData);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSuccess(editingJob ? "Job updated successfully!" : "Job created successfully!");
    setShowModal(false);
    setEditingJob(null);
    // Reset customer fields
    setSelectedCustomerId("");
    setEditableCustomerName("");
    setEditableCustomerPhone("");
    setEditableCustomerEmail("");
    setEditableCustomerCompany("");
    // Reset assigned workers
    setAssignedWorkerIds([""]);
    loadData();
  };

  const handleJobSubmitAfterCustomerUpdate = async () => {
    // This is called after customer update is confirmed
    const form = document.querySelector('form[data-job-form]') as HTMLFormElement;
    if (!form) return;

    const formData = new FormData(form);
    
    // Ensure customerId is set
    if (selectedCustomerId) {
      formData.set("customerId", selectedCustomerId);
    }
    
    // Convert estimated duration
    const rawDuration = formData.get("estimatedDurationValue") as string;
    const rawUnit = (formData.get("estimatedDurationUnit") as string) || "HOURS";

    if (rawDuration) {
      const value = parseFloat(rawDuration);
      if (!Number.isNaN(value) && value > 0) {
        const HOURS_PER_DAY = 8;
        const HOURS_PER_WEEK = HOURS_PER_DAY * 5;
        const HOURS_PER_MONTH = HOURS_PER_WEEK * 4;

        let hours = value;
        switch (rawUnit) {
          case "DAYS":
            hours = value * HOURS_PER_DAY;
            break;
          case "WEEKS":
            hours = value * HOURS_PER_WEEK;
            break;
          case "MONTHS":
            hours = value * HOURS_PER_MONTH;
            break;
          case "HOURS":
          default:
            hours = value;
            break;
        }

        formData.set("estimatedHours", hours.toString());
      }
    }

    const res = editingJob
      ? await updateJob(editingJob.id, formData)
      : await createJob(formData);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSuccess(editingJob ? "Job updated successfully!" : "Job created successfully!");
    setShowModal(false);
    setEditingJob(null);
    // Reset customer fields
    setSelectedCustomerId("");
    setEditableCustomerName("");
    setEditableCustomerPhone("");
    setEditableCustomerEmail("");
    setEditableCustomerCompany("");
    // Reset assigned workers
    setAssignedWorkerIds([""]);
    loadData();
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job?")) return;

    const res = await deleteJob(jobId);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSuccess("Job deleted successfully!");
    loadData();
  };

  const openCreateModal = () => {
    // Only ADMIN and MANAGER can create jobs
    if (!canManage) {
      setError("You do not have permission to create jobs. Only administrators and managers can create new jobs.");
      return;
    }
    setEditingJob(null);
    // Reset customer fields
    setSelectedCustomerId("");
    setEditableCustomerName("");
    setEditableCustomerPhone("");
    setEditableCustomerEmail("");
    setEditableCustomerCompany("");
    // Reset assigned workers
    setAssignedWorkerIds([""]);
    setShowModal(true);
  };

  const openEditModal = (job: Job) => {
    // Only ADMIN and MANAGER can edit jobs
    if (!canManage) {
      setError("You do not have permission to edit jobs. Only administrators and managers can edit job details.");
      return;
    }
    // Prevent editing jobs that are submitted to QC or completed
    if (job.status === "AWAITING_QC" || job.status === "COMPLETED") {
      setError("This job has been submitted to QC and cannot be edited until returned for rework.");
      return;
    }
    setEditingJob(job);
    // Populate customer fields if job has a customer
    if (job.customer) {
      setSelectedCustomerId(job.customer.id);
      setEditableCustomerName(job.customer.name || "");
      setEditableCustomerPhone(job.customer.phone || "");
      setEditableCustomerEmail(job.customer.email || "");
      setEditableCustomerCompany(job.customer.company || "");
    } else {
      setSelectedCustomerId("");
      setEditableCustomerName("");
      setEditableCustomerPhone("");
      setEditableCustomerEmail("");
      setEditableCustomerCompany("");
    }
    // Populate assigned workers
    if (job.assignments && job.assignments.length > 0) {
      setAssignedWorkerIds(job.assignments.map(a => a.user.id));
    } else if (job.assignee) {
      setAssignedWorkerIds([(job as any).assignedTo]);
    } else {
      setAssignedWorkerIds([""]);
    }
    setShowModal(true);
  };

  const openActivityModal = async (job: Job) => {
    // Prevent opening if job is locked
    if (job.status === "AWAITING_QC" || job.status === "COMPLETED") {
      setError("This job has been submitted to QC and cannot be edited until returned for rework.");
      return;
    }
    setSelectedJobForActivity(job);
    setShowActivityModal(true);
    setLoadingActivities(true);
    
    const res = await getJobActivities(job.id);
    if (res.ok && res.activities) {
      setJobActivities(res.activities);
    } else {
      setError(res.error || "Failed to load activities");
    }
    setLoadingActivities(false);
  };

  // Expenses handlers

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobForMaterialsAndExpenses) return;

    setAddingExpense(true);
    setError(undefined);

    const formData = new FormData();
    formData.append("jobId", selectedJobForMaterialsAndExpenses.id);
    formData.append("category", expenseCategory);
    formData.append("description", expenseDescription);
    formData.append("amount", expenseAmount);
    formData.append("quantity", expenseQuantity);
    formData.append("unit", expenseUnit);
    formData.append("notes", expenseNotes);
    if (expenseReceiptUrl) {
      formData.append("receiptUrl", expenseReceiptUrl);
    }

    const res = await addJobExpense(formData);
    if (res.ok) {
      setSuccess("Expense added successfully!");
      setExpenseCategory("Materials");
      setExpenseDescription("");
      setExpenseAmount("");
      setExpenseQuantity("1");
      setExpenseUnit("");
      setExpenseNotes("");
      setExpenseReceiptUrl(null);
      // Refresh expenses and materials
      await openMaterialsAndExpensesModal(selectedJobForMaterialsAndExpenses);
      await loadData(); // Refresh jobs to update profit calculations
    } else {
      setError(res.error || "Failed to add expense");
    }

    setAddingExpense(false);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    setError(undefined);
    const res = await deleteJobExpense(expenseId);
    if (res.ok) {
      setSuccess("Expense deleted successfully!");
      if (selectedJobForMaterialsAndExpenses) {
        await openMaterialsAndExpensesModal(selectedJobForMaterialsAndExpenses);
        await loadData(); // Refresh jobs to update profit calculations
      }
    } else {
      setError(res.error || "Failed to delete expense");
    }
  };

  const handleReceiptScanComplete = (amount: number, receiptUrl: string) => {
    setExpenseAmount(amount.toFixed(2));
    setExpenseReceiptUrl(receiptUrl);
    setShowReceiptScanner(false);
    setSuccess("Receipt scanned successfully! Amount filled automatically.");
  };

  const handleJobPhotoSelect = (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setJobPhotoFiles((prev) => ({
      ...prev,
      [jobId]: [...(prev[jobId] || []), ...files],
    }));
  };

  const removeJobPhoto = (jobId: string, index: number) => {
    setJobPhotoFiles((prev) => ({
      ...prev,
      [jobId]: (prev[jobId] || []).filter((_, i) => i !== index),
    }));
  };

  // Helper function to collect all photos from a job (similar to QC)
  const getAllJobPhotos = (job: Job, activitiesOverride?: any[]): string[] => {
    const allPhotos: string[] = [];
    
    // Use provided activities or job activities
    const activitiesToUse = activitiesOverride || (job as any).activities || [];
    
    // Photos from job activities
    activitiesToUse.forEach((activity: any) => {
      if (activity.images) {
        try {
          const parsed = JSON.parse(activity.images);
          if (Array.isArray(parsed)) {
            allPhotos.push(...parsed);
          }
        } catch {
          // If not JSON, treat as single URL
          if (typeof activity.images === "string") {
            allPhotos.push(activity.images);
          }
        }
      }
    });
    
    return allPhotos;
  };

  // Open photo viewer with all photos from a job
  const openPhotoViewer = (job: Job, initialIndex: number = 0, activitiesOverride?: any[]) => {
    const allPhotos = getAllJobPhotos(job, activitiesOverride);
    if (allPhotos.length > 0) {
      setPhotoViewerPhotos(allPhotos);
      setPhotoViewerIndex(initialIndex);
      setShowPhotoViewer(true);
    }
  };

  const handleSavePhotos = async (jobId: string) => {
    const files = jobPhotoFiles[jobId] || [];
    if (files.length === 0) {
      setError("Please select at least one photo");
      return;
    }

    setSavingPhotos((prev) => ({ ...prev, [jobId]: true }));
    setError(undefined);

    try {
      // Upload images
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        setError(errorData.error || "Failed to upload photos. Please check your storage configuration.");
        setSavingPhotos((prev) => ({ ...prev, [jobId]: false }));
        return;
      }

      const uploadData = await uploadRes.json();
      const imagePaths = uploadData.paths || [];

      // Save photos to job
      const saveFormData = new FormData();
      saveFormData.append("jobId", jobId);
      saveFormData.append("images", JSON.stringify(imagePaths));

      const res = await saveJobPhotos(saveFormData);
      if (res.ok) {
        setSuccess("Photos saved successfully!");
        setJobPhotoFiles((prev) => ({ ...prev, [jobId]: [] }));
        await loadData(); // Refresh jobs to show new photos
      } else {
        setError(res.error || "Failed to save photos");
      }
    } catch (err: any) {
      console.error("Save photos error:", err);
      setError(err?.message || "Failed to save photos");
    } finally {
      setSavingPhotos((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleSubmitToQC = async (jobId: string) => {
    const files = jobPhotoFiles[jobId] || [];

    setSavingPhotos((prev) => ({ ...prev, [jobId]: true }));
    setError(undefined);

    try {
      let imagePaths: string[] = [];

      // Upload images if any selected
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json().catch(() => ({}));
          setError(errorData.error || "Failed to upload photos. Please check your storage configuration.");
          setSavingPhotos((prev) => ({ ...prev, [jobId]: false }));
          return;
        }

        const uploadData = await uploadRes.json();
        imagePaths = uploadData.paths || [];
      }

      // Submit photos and job to QC
      const submitFormData = new FormData();
      submitFormData.append("jobId", jobId);
      if (imagePaths.length > 0) {
        submitFormData.append("images", JSON.stringify(imagePaths));
      }

      const res = await submitJobPhotosToQC(submitFormData);
      if (res.ok) {
        setSuccess("Job submitted to QC successfully! The job is now locked for editing.");
        setJobPhotoFiles((prev) => ({ ...prev, [jobId]: [] }));
        await loadData(); // Refresh jobs
      } else {
        setError(res.error || "Failed to submit to QC");
      }
    } catch (err: any) {
      console.error("Submit to QC error:", err);
      setError(err?.message || "Failed to submit to QC");
    } finally {
      setSavingPhotos((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleRemovePhoto = async (jobId: string, photoId: string, photoUrl: string, activityId: string) => {
    setRemovingPhotos((prev) => ({ ...prev, [photoId]: true }));
    setError(undefined);

    try {
      const formData = new FormData();
      formData.append("activityId", activityId);
      formData.append("photoUrl", photoUrl);

      const res = await removeJobPhotoFromDB(formData);
      if (res.ok) {
        setSuccess("Photo removed successfully!");
        await loadData(); // Refresh to update photo list
      } else {
        setError(res.error || "Failed to remove photo");
      }
    } catch (err: any) {
      console.error("Remove photo error:", err);
      setError(err?.message || "Failed to remove photo");
    } finally {
      setRemovingPhotos((prev => {
        const updated = { ...prev };
        delete updated[photoId];
        return updated;
      }));
    }
  };

  const openMaterialsAndExpensesModal = async (job: Job) => {
    setSelectedJobForMaterialsAndExpenses(job);
    setShowMaterialsAndExpensesModal(true);
    setActiveTab("materials");
    setLoadingMaterials(true);
    setLoadingExpenses(true);
    
    // Load both materials and expenses
    const [materialsRes, expensesRes] = await Promise.all([
      getJobMaterialRequests(job.id),
      getJobExpenses(job.id)
    ]);
    
    if (materialsRes.ok) {
      setJobMaterialRequests(materialsRes.requests as any);
    } else {
      setError(materialsRes.error);
    }
    
    if (expensesRes.ok && expensesRes.expenses) {
      setJobExpenses(expensesRes.expenses);
    } else {
      setError(expensesRes.error || "Failed to load expenses");
    }
    
    setLoadingMaterials(false);
    setLoadingExpenses(false);
  };

  const handleMaterialRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobForMaterialsAndExpenses) return;

    // Prevent creating material requests if job is locked
    if (selectedJobForMaterialsAndExpenses.status === "AWAITING_QC" || selectedJobForMaterialsAndExpenses.status === "COMPLETED") {
      setError("This job has been submitted to QC and cannot be edited until returned for rework.");
      return;
    }

    setSubmittingMaterial(true);
    setError(undefined);

    const formData = new FormData();
    formData.append("jobId", selectedJobForMaterialsAndExpenses.id);
    formData.append("itemName", materialItemName);
    // Ensure quantity is a whole number between 1-9
    const quantity = Math.max(1, Math.min(9, Math.floor(materialQuantity)));
    formData.append("quantity", quantity.toString());
    formData.append("unit", materialUnit);
    formData.append("description", materialDescription);
    formData.append("priority", materialPriority);
    formData.append("notes", materialNotes);

    const res = await createMaterialRequest(formData);
    
    if (!res.ok) {
      setError(res.error);
      setSubmittingMaterial(false);
      return;
    }

    setSuccess(`Material request submitted for ${materialItemName}!`);
    setMaterialItemName("");
    setMaterialQuantity(1);
    setMaterialUnit("pcs");
    setMaterialDescription("");
    setMaterialPriority("MEDIUM");
    setMaterialNotes("");
    
    // Refresh material requests and expenses
    await openMaterialsAndExpensesModal(selectedJobForMaterialsAndExpenses);
    setSubmittingMaterial(false);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    const formData = new FormData();
    formData.append("name", newCustomerName);
    formData.append("phone", newCustomerPhone);
    formData.append("email", newCustomerEmail);
    formData.append("company", newCustomerCompany);

    const res = await createCustomer(formData);
    if (res.ok && res.customer) {
      setCustomers([...customers, res.customer as any]);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setNewCustomerCompany("");
      setShowCustomerForm(false);
      setSuccess("Customer created successfully!");
    } else {
      setError(res.error);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setEditableCustomerName(customer.name || "");
        setEditableCustomerPhone(customer.phone || "");
        setEditableCustomerEmail(customer.email || "");
        setEditableCustomerCompany(customer.company || "");
      }
    } else {
      setEditableCustomerName("");
      setEditableCustomerPhone("");
      setEditableCustomerEmail("");
      setEditableCustomerCompany("");
    }
  };

  const handleCustomerUpdateConfirm = async () => {
    if (!pendingCustomerUpdate) return;
    
    setError(undefined);
    const res = await updateCustomer(pendingCustomerUpdate.customerId, pendingCustomerUpdate.formData);
    
    if (res.ok && res.customer) {
      // Update customers list
      setCustomers(customers.map(c => c.id === res.customer?.id ? res.customer as any : c));
      setSuccess("Customer updated successfully!");
      setShowCustomerUpdateConfirm(false);
      setPendingCustomerUpdate(null);
      
      // Continue with job submission
      await handleJobSubmitAfterCustomerUpdate();
    } else {
      setError(res.error || "Failed to update customer");
      setShowCustomerUpdateConfirm(false);
      setPendingCustomerUpdate(null);
    }
  };



  // Quotation Functions
  const openQuotationModal = async (job: Job) => {
    if (!canManage) {
      setError("Only managers and admins can create quotations");
      return;
    }

    setSelectedJobForQuotation(job);
    setShowQuotationModal(true);
    
    // Load company settings if not already loaded
    if (!companySettings) {
      const settings = await getCompanySettingsForInvoice();
      setCompanySettings(settings);
    }
    
    // Try to load the last saved quotation for this job
    const quotationsRes = await getQuotationsByJobId(job.id);
    let lastQuotation = null;
    if (quotationsRes.ok && quotationsRes.quotations && quotationsRes.quotations.length > 0) {
      // Get the most recent quotation (first one since they're ordered by createdAt desc)
      lastQuotation = quotationsRes.quotations[0];
    }
    
    if (lastQuotation) {
      // Load existing quotation data
      setCurrentQuotationId(lastQuotation.id);
      setQuotationDate(lastQuotation.issueDate ? formatDateInput(new Date(lastQuotation.issueDate)) : todayCentralISO());
      setQuotationValidUntil(lastQuotation.validUntil ? formatDateInput(new Date(lastQuotation.validUntil)) : "");
      setQuotationLineItems(lastQuotation.lines || []);
      setQuotationNotes(lastQuotation.notes || "");
      setQuotationShippingFee(lastQuotation.shippingFee || 0);
      setQuotationPaymentBank(lastQuotation.paymentBank || "");
      setQuotationPaymentAccountName(lastQuotation.paymentAccountName || "");
      setQuotationPaymentAccountNumber(lastQuotation.paymentAccountNumber || "");
      setQuotationPreparedByName(lastQuotation.preparedByName || "");
      setQuotationPreparedByTitle(lastQuotation.preparedByTitle || "");
      setQuotationCustomerName(lastQuotation.customerName || "");
      setQuotationCustomerAddress(lastQuotation.customerAddress || "");
      setQuotationCustomerPhone(lastQuotation.customerPhone || "");
      setQuotationCustomerEmail(lastQuotation.customerEmail || "");
    } else {
      // New quotation - set defaults
      setCurrentQuotationId(null);
      setQuotationDate(todayCentralISO());
      
      // Set valid until date to 30 days from now in Central Time
      const validUntil = nowInCentral().add(30, 'day');
      setQuotationValidUntil(validUntil.format('YYYY-MM-DD'));
      
      // Auto-populate customer info
      if (job.customer) {
        setQuotationCustomerName(job.customer.name || "");
        setQuotationCustomerAddress(job.customer.company || "");
        setQuotationCustomerPhone(job.customer.phone || "");
        setQuotationCustomerEmail(job.customer.email || "");
      }
      
      // Auto-populate prepared by with current user's name
      if (session?.user?.name) {
        setQuotationPreparedByName(session.user.name);
      }
      
      // Auto-generate quotation line items based on job pricing
      const lineItems = [];
      
      if (job.estimatedPrice && job.estimatedPrice > 0) {
        lineItems.push({
          description: job.title,
          quantity: 1,
          rate: job.estimatedPrice,
          amount: job.estimatedPrice,
        });
      } else {
        lineItems.push({
          description: job.title,
          quantity: 1,
          rate: 0,
          amount: 0,
        });
      }
      
      setQuotationLineItems(lineItems);
      setQuotationNotes("This quotation is valid for 30 days from the date above. Final pricing may vary based on actual work performed.");
      setQuotationShippingFee(0);
      setQuotationPaymentBank("");
      setQuotationPaymentAccountName("");
      setQuotationPaymentAccountNumber("");
      setQuotationPreparedByName("");
      setQuotationPreparedByTitle("");
    }
    
    // Auto-save after a short delay
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSaveQuotation();
    }, 2000); // Auto-save after 2 seconds of inactivity
  };
  

  const addQuotationLineItem = () => {
    setQuotationLineItems([
      ...quotationLineItems,
      { description: "", quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  const updateQuotationLineItem = (index: number, field: string, value: any) => {
    const updated = [...quotationLineItems];
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
    setQuotationLineItems(updated);
    
    // Trigger auto-save after changes
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSaveQuotation();
    }, 2000);
  };

  const removeQuotationLineItem = (index: number) => {
    setQuotationLineItems(quotationLineItems.filter((_, i) => i !== index));
  };

  const calculateQuotationSubtotal = () => {
    return quotationLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const calculateQuotationTotal = () => {
    return calculateQuotationSubtotal() + (quotationShippingFee || 0);
  };

  const handleAutoSaveQuotation = async () => {
    if (!selectedJobForQuotation || !canManage) return;
    if (quotationLineItems.length === 0) return; // Don't save empty quotations

    setAutoSavingQuotation(true);
    try {
      const formData = new FormData();
      if (currentQuotationId) {
        formData.append("quotationId", currentQuotationId);
      }
      formData.append("jobId", selectedJobForQuotation.id);
      if (selectedJobForQuotation.customer?.id) {
        formData.append("customerId", selectedJobForQuotation.customer.id);
      }
      formData.append("customerName", quotationCustomerName);
      formData.append("customerAddress", quotationCustomerAddress);
      formData.append("customerPhone", quotationCustomerPhone);
      formData.append("customerEmail", quotationCustomerEmail);
      formData.append("issueDate", quotationDate);
      formData.append("validUntil", quotationValidUntil);
      formData.append("notes", quotationNotes);
      formData.append("shippingFee", quotationShippingFee.toString());
      formData.append("paymentBank", quotationPaymentBank);
      formData.append("paymentAccountName", quotationPaymentAccountName);
      formData.append("paymentAccountNumber", quotationPaymentAccountNumber);
      formData.append("preparedByName", quotationPreparedByName);
      formData.append("preparedByTitle", quotationPreparedByTitle);
      formData.append("lines", JSON.stringify(quotationLineItems));

      const res = currentQuotationId 
        ? await updateQuotation(formData)
        : await createQuotation(formData);
      
      if (res.ok && res.quotation) {
        setCurrentQuotationId(res.quotation.id);
      }
    } catch (err: any) {
      console.error("Auto-save error:", err);
    } finally {
      setAutoSavingQuotation(false);
    }
  };

  const handleSaveQuotation = async () => {
    if (!selectedJobForQuotation || !canManage) {
      setError("Unauthorized");
      return;
    }

    setSavingQuotation(true);
    setError(undefined);

    try {
      const formData = new FormData();
      if (currentQuotationId) {
        formData.append("quotationId", currentQuotationId);
      }
      formData.append("jobId", selectedJobForQuotation.id);
      if (selectedJobForQuotation.customer?.id) {
        formData.append("customerId", selectedJobForQuotation.customer.id);
      }
      formData.append("customerName", quotationCustomerName);
      formData.append("customerAddress", quotationCustomerAddress);
      formData.append("customerPhone", quotationCustomerPhone);
      formData.append("customerEmail", quotationCustomerEmail);
      formData.append("issueDate", quotationDate);
      formData.append("validUntil", quotationValidUntil);
      formData.append("notes", quotationNotes);
      formData.append("shippingFee", quotationShippingFee.toString());
      formData.append("paymentBank", quotationPaymentBank);
      formData.append("paymentAccountName", quotationPaymentAccountName);
      formData.append("paymentAccountNumber", quotationPaymentAccountNumber);
      formData.append("preparedByName", quotationPreparedByName);
      formData.append("preparedByTitle", quotationPreparedByTitle);
      formData.append("lines", JSON.stringify(quotationLineItems));

      const res = currentQuotationId 
        ? await updateQuotation(formData)
        : await createQuotation(formData);
    
      if (res.ok) {
        setSuccess(currentQuotationId ? "Quotation updated successfully!" : "Quotation created successfully!");
        if (res.quotation) {
          setCurrentQuotationId(res.quotation.id);
        }
      } else {
        setError(res.error || "Failed to save quotation");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save quotation");
    } finally {
      setSavingQuotation(false);
    }
  };

  const handleDownloadQuotationPDF = async () => {
    if (!selectedJobForQuotation || !companySettings) {
      setError("Job data or company settings not loaded");
      return;
    }

    const subtotal = calculateQuotationSubtotal();
    const total = calculateQuotationTotal();

    // Attempt to fetch logo and convert to data URL for embedding
    let logoDataUrl: string | undefined;
    if (companySettings.logoUrl) {
      try {
        // Handle both absolute URLs and relative paths
        let logoUrl = companySettings.logoUrl;
        
        // If it's a relative URL or needs CORS, try to fetch it
        // For Supabase public URLs, they should work with fetch
        const resp = await fetch(logoUrl, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
        });
        
        if (resp.ok) {
          const blob = await resp.blob();
          
          // Check if blob is actually an image
          if (blob.type.startsWith('image/')) {
            const reader = new FileReader();
            logoDataUrl = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                if (reader.result && typeof reader.result === 'string') {
                  resolve(reader.result);
                } else {
                  reject(new Error("Failed to convert logo to data URL"));
                }
              };
              reader.onerror = () => reject(new Error("FileReader error"));
              reader.readAsDataURL(blob);
            });
            
            // Preload image to ensure dimensions are available and validate it
            if (logoDataUrl) {
              const img = new Image();
              img.src = logoDataUrl;
              await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error("Image load timeout"));
                }, 5000);
                
                img.onload = () => {
                  clearTimeout(timeout);
                  // Validate image loaded successfully
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    resolve();
                  } else {
                    reject(new Error("Invalid image dimensions"));
                  }
                };
                img.onerror = () => {
                  clearTimeout(timeout);
                  reject(new Error("Image failed to load"));
                };
              });
            }
          } else {
            console.warn("Logo URL does not point to an image file:", blob.type);
          }
        } else {
          console.warn("Failed to fetch logo from URL:", logoUrl, "Status:", resp.status);
        }
      } catch (error) {
        console.error("Error loading logo for quotation:", error);
        // Continue without logo - fallback text logo will be used
      }
    }

    const pdfData: QuotationPDFData = {
      quotationDate: quotationDate,
      validUntil: quotationValidUntil || undefined,
      companyName: companySettings?.companyName || "TCB METAL WORKS",
      companyAddress: companySettings?.address || undefined,
      companyCity: companySettings?.city || undefined,
      companyState: companySettings?.state || undefined,
      companyZipCode: companySettings?.zipCode || undefined,
      companyPhone: companySettings?.phone || undefined,
      companyEmail: companySettings?.email || undefined,
      logoDataUrl,
      customerName: quotationCustomerName || selectedJobForQuotation.customer?.name || "Customer",
      customerAddress: quotationCustomerAddress || selectedJobForQuotation.customer?.company || undefined,
      customerPhone: quotationCustomerPhone || selectedJobForQuotation.customer?.phone || undefined,
      customerEmail: quotationCustomerEmail || selectedJobForQuotation.customer?.email || undefined,
      lineItems: quotationLineItems,
      subtotal,
      shippingFee: quotationShippingFee || 0,
      total,
      notes: quotationNotes || undefined,
      paymentBank: quotationPaymentBank || undefined,
      paymentAccountName: quotationPaymentAccountName || undefined,
      paymentAccountNumber: quotationPaymentAccountNumber || undefined,
      preparedByName: quotationPreparedByName || undefined,
      preparedByTitle: quotationPreparedByTitle || undefined,
    };

    const pdf = await generateQuotationPDF(pdfData);
    const jobTitle = selectedJobForQuotation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    pdf.save(`quotation-${jobTitle}-${todayCentralISO()}.pdf`);
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case "NOT_STARTED":
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"; // Treat legacy PENDING as NOT_STARTED
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "AWAITING_QC":
        return "bg-purple-100 text-purple-800";
      case "REWORK":
        return "bg-orange-100 text-orange-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-100 text-red-800";
      case "HIGH":
        return "bg-orange-100 text-orange-800";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800";
      case "LOW":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Jobs are already filtered on the backend, so we just use them directly
  // No need for client-side filtering since pagination is server-side
  const filteredJobs = useMemo(() => jobs, [jobs]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No due date";
    return formatDateShort(dateString);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black border-b-2 border-[#001f3f] shadow-lg sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Job Management</h1>
            <p className="text-xs sm:text-sm text-gray-300">View and manage all jobs</p>
          </div>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-4 py-2 border border-gray-400 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium text-white"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            ✓ {success}
          </div>
        )}

        {/* Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by job title, description, customer, or job number..."
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base sm:text-sm flex-1 min-w-0 sm:min-w-[200px] min-h-[44px] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all bg-white shadow-sm"
            />
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await exportJobsToCSV();
                  if (res.ok && 'csv' in res && res.csv) {
                    // Create and download CSV file
                    const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = res.filename || "jobs_export.csv";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } else {
                    alert("Failed to export: " + ('error' in res ? res.error : "Unknown error"));
                  }
                }}
                className="w-full md:w-auto min-h-[44px] bg-white border-2 border-gray-300 text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold shadow-sm"
              >
                📥 Export CSV
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="w-full md:w-auto min-h-[44px] bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-indigo-700 hover:to-blue-700 transition-all font-semibold shadow-md hover:shadow-lg"
              >
                + Create Job
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        {canManage && (
          <JobFilters 
            customers={customers} 
            users={users}
            statusFilter={filterStatus}
            customerFilter={filterCustomer}
            workerFilter={filterWorker}
            dateFrom={filterDateFrom}
            dateTo={filterDateTo}
            onStatusChange={setFilterStatus}
            onCustomerChange={setFilterCustomer}
            onWorkerChange={setFilterWorker}
            onDateFromChange={setFilterDateFrom}
            onDateToChange={setFilterDateTo}
          />
        )}

        {/* Debug Info (Development Only) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mb-4 p-4 bg-gray-100 border border-gray-300 rounded-lg text-xs">
            <p><strong>Debug Info:</strong></p>
            <p>Loading: {loading ? "Yes" : "No"}</p>
            <p>Error: {error || "None"}</p>
            <p>Jobs in state: {jobs.length}</p>
            <p>Current page: {currentPage} / {totalPages}</p>
            <p>Total count: {totalCount}</p>
            <p>Page size: {pageSize}</p>
            <p>Search query: {searchQuery || "(empty)"}</p>
            <p>Debounced search: {debouncedSearchQuery || "(empty)"}</p>
            <p>Session status: {sessionStatus}</p>
            {session?.user && (
              <p>User role: {(session.user as any)?.role}</p>
            )}
          </div>
        )}

        {/* Jobs Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-gray-500">Loading jobs...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-sm p-8 text-center">
            <p className="text-lg font-medium text-red-800 mb-2">Error Loading Jobs</p>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => loadData()}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Retry
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center text-gray-600">
            <p className="text-lg font-medium mb-2">No jobs found</p>
            <p className="text-sm">
              {jobs.length === 0
                ? canManage
                  ? "Create your first job to get started"
                  : "No jobs assigned to you yet"
                : "Try adjusting your filters or search query"}
            </p>
            {canManage && jobs.length === 0 && (
              <button
                onClick={openCreateModal}
                className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create First Job
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-2xl shadow-lg border-2 border-indigo-100 overflow-hidden">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                  <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-indigo-600 to-blue-600">
                  <tr>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Job Number
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Job Title
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Client
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Assigned Workers
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Start Date
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Deadline
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-center text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredJobs.length > 0 ? (
                    filteredJobs.map((job) => {
                      if (!job || !job.id) {
                        console.warn("[JobsPage] Invalid job in filteredJobs:", job);
                        return null;
                      }
                      return (
                        <JobRow
                          key={job.id}
                          job={job}
                          canManage={canManage}
                          onEdit={openEditModal}
                          onDelete={handleDelete}
                          onViewPhotos={(photos, index) => {
                            setPhotoViewerPhotos(photos);
                            setPhotoViewerIndex(index);
                            setShowPhotoViewer(true);
                          }}
                          getAllJobPhotos={getAllJobPhotos}
                          jobExistingPhotos={jobExistingPhotos[job.id] || []}
                          onActivity={openActivityModal}
                          onMaterialsAndExpenses={openMaterialsAndExpensesModal}
                          onQuotation={openQuotationModal}
                          jobExpenses={job.expenses || []}
                          onPhotoSelect={handleJobPhotoSelect}
                          onSavePhotos={handleSavePhotos}
                          onSubmitToQC={handleSubmitToQC}
                          onRemovePhoto={handleRemovePhoto}
                          onRemovePhotoFile={removeJobPhoto}
                          jobPhotoFiles={jobPhotoFiles}
                          savingPhotos={savingPhotos}
                          removingPhotos={removingPhotos}
                          openPhotoViewer={openPhotoViewer}
                        />
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                        No jobs to display
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
                </div>
              </div>
            </div>

            {/* Mobile Card View */}
            <MobileCardView
              items={filteredJobs}
              emptyMessage="No jobs to display"
              className="md:hidden p-4"
              renderCard={(job) => (
                <div
                  onClick={() => {
                    const jobRow = document.querySelector(`[data-job-id="${job.id}"]`);
                    if (jobRow) {
                      (jobRow as HTMLElement).click();
                    }
                  }}
                  className="bg-white border-2 border-gray-200 rounded-xl p-4 mb-4 shadow-sm hover:shadow-md active:shadow-lg transition-all touch-manipulation"
                  data-job-id={job.id}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-medium text-gray-900 text-sm mb-1">
                        {job.jobNumber || `#${job.id.substring(0, 8).toUpperCase()}`}
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{job.title}</h3>
                      {job.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{job.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${
                        job.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : job.status === "REWORK"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : job.status === "AWAITING_QC"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : job.status === "IN_PROGRESS"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : job.status === "CANCELLED"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {job.status === "AWAITING_QC" ? "Submit to QC" : job.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {job.customer && (
                      <div>
                        <span className="text-gray-500">Client:</span>
                        <span className="ml-2 text-gray-900 font-medium">{job.customer.name || "-"}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Start:</span>
                      <span className="ml-2 text-gray-900 font-medium">
                        {formatDateShort(job.createdAt)}
                      </span>
                    </div>
                    {job.dueDate && (
                      <div>
                        <span className="text-gray-500">Deadline:</span>
                        <span className="ml-2 text-gray-900 font-medium">
                          {formatDateShort(job.dueDate)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Workers:</span>
                      <span className="ml-2 text-gray-900 font-medium">
                        {job.assignments && job.assignments.length > 0
                          ? job.assignments.map((a: any) => a.user?.name).filter(Boolean).join(", ") || "Unassigned"
                          : job.assignee
                          ? job.assignee.name
                          : "Unassigned"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            />
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-t-2 border-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} jobs
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1);
                      setCurrentPage(newPage);
                      loadData(newPage);
                    }}
                    disabled={currentPage === 1 || loading}
                    className="px-4 py-2 text-sm border-2 border-gray-300 rounded-xl hover:bg-white hover:border-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] font-medium bg-white"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            loadData(pageNum);
                          }}
                          disabled={loading}
                          className={`px-4 py-2 text-sm border-2 rounded-xl min-h-[44px] font-semibold transition-all ${
                            currentPage === pageNum
                              ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-md"
                              : "border-gray-300 hover:bg-white hover:border-indigo-300 bg-white"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      const newPage = Math.min(totalPages, currentPage + 1);
                      setCurrentPage(newPage);
                      loadData(newPage);
                    }}
                    disabled={currentPage === totalPages || loading}
                    className="px-4 py-2 text-sm border-2 border-gray-300 rounded-xl hover:bg-white hover:border-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] font-medium bg-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <MobileModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingJob(null);
        }}
        title={editingJob ? "Edit Job" : "Create New Job"}
      >
        {editingJob && (editingJob.status === "AWAITING_QC" || editingJob.status === "COMPLETED") && (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-800 font-medium">
              🔒 This job has been submitted to QC and is locked for editing. It will be unlocked if returned for rework.
            </p>
          </div>
        )}

        {(() => {
          const isLocked = !!(editingJob && (editingJob.status === "AWAITING_QC" || editingJob.status === "COMPLETED"));
          const isEmployee = !canManage;
          return (
            <form onSubmit={handleSubmit} className="space-y-4" data-job-form>
                    {isEmployee && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800 font-medium">
                          ⚠️ You do not have permission to edit jobs. Only administrators and managers can edit job details.
                        </p>
                      </div>
                    )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    name="title"
                    type="text"
                    defaultValue={editingJob?.title}
                    required
                      disabled={isLocked || isEmployee}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    defaultValue={editingJob?.description || ""}
                    rows={4}
                      disabled={isLocked || isEmployee}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status *
                    </label>
                    <select
                      name="status"
                  defaultValue={editingJob?.status || "NOT_STARTED"}
                      required
                      disabled={isLocked || isEmployee}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                  <option value="NOT_STARTED">Not Started</option>
                      <option value="IN_PROGRESS">In Progress</option>
                  <option value="AWAITING_QC">Submit to QC</option>
                  <option value="REWORK">Rework</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority *
                    </label>
                    <select
                      name="priority"
                      defaultValue={editingJob?.priority || "MEDIUM"}
                      required
                      disabled={isLocked || isEmployee}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                {canManage && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assign to Workers
                      </label>
                      <div className="space-y-2">
                        {assignedWorkerIds.map((workerId, index) => (
                          <div key={index} className="flex gap-2 items-start">
                            <select
                              value={workerId}
                              onChange={(e) => {
                                const newIds = [...assignedWorkerIds];
                                newIds[index] = e.target.value;
                                setAssignedWorkerIds(newIds);
                              }}
                              disabled={isLocked || isEmployee}
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base disabled:bg-gray-100 disabled:cursor-not-allowed min-h-[44px]"
                            >
                              <option value="">Select worker...</option>
                              {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name} ({user.role})
                                </option>
                              ))}
                            </select>
                            {assignedWorkerIds.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newIds = assignedWorkerIds.filter((_, i) => i !== index);
                                  setAssignedWorkerIds(newIds.length > 0 ? newIds : [""]);
                                }}
                                disabled={isLocked || isEmployee}
                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-300 disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center text-lg font-bold"
                                title="Remove worker"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAssignedWorkerIds([...assignedWorkerIds, ""]);
                            }}
                            disabled={isLocked || isEmployee}
                            className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2 font-medium"
                          >
                            <span className="text-lg">+</span>
                            <span>Add Worker</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const allUserIds = users.map(user => user.id);
                              setAssignedWorkerIds(allUserIds.length > 0 ? allUserIds : [""]);
                            }}
                            disabled={isLocked || isEmployee || users.length === 0}
                            className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2 font-medium"
                          >
                            <span>✓</span>
                            <span>Assign to All</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Customer
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCustomerForm(!showCustomerForm)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {showCustomerForm ? "Cancel" : "+ New Customer"}
                        </button>
                      </div>

                      {showCustomerForm ? (
                        <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
                          <input
                            type="text"
                            value={newCustomerName}
                            onChange={(e) => setNewCustomerName(e.target.value)}
                            placeholder="Customer name *"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            required
                          />
                          <input
                            type="tel"
                            value={newCustomerPhone}
                            onChange={(e) => setNewCustomerPhone(e.target.value)}
                            placeholder="Phone"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                          <input
                            type="email"
                            value={newCustomerEmail}
                            onChange={(e) => setNewCustomerEmail(e.target.value)}
                            placeholder="Email"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                          <input
                            type="text"
                            value={newCustomerCompany}
                            onChange={(e) => setNewCustomerCompany(e.target.value)}
                            placeholder="Company"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={handleCreateCustomer}
                            disabled={!newCustomerName}
                            className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300"
                          >
                            Create Customer
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <select
                            name="customerId"
                            value={selectedCustomerId}
                            onChange={(e) => {
                              handleCustomerSelect(e.target.value);
                              // Also update the form field
                              e.currentTarget.value = e.target.value;
                            }}
                            disabled={isLocked || isEmployee}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="">No Customer</option>
                            {customers.map((customer) => (
                              <option key={customer.id} value={customer.id}>
                                {customer.name} {customer.company && `(${customer.company})`}
                              </option>
                            ))}
                          </select>
                          
                          {/* Editable Customer Fields - Only show if customer is selected and user can manage */}
                          {selectedCustomerId && canManage && (
                            <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
                              <p className="text-xs font-medium text-blue-900 mb-2">
                                ✏️ Edit Customer Information
                              </p>
                              <input
                                type="text"
                                value={editableCustomerName}
                                onChange={(e) => setEditableCustomerName(e.target.value)}
                                placeholder="Customer name *"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              />
                              <input
                                type="tel"
                                value={editableCustomerPhone}
                                onChange={(e) => setEditableCustomerPhone(e.target.value)}
                                placeholder="Phone"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="email"
                                value={editableCustomerEmail}
                                onChange={(e) => setEditableCustomerEmail(e.target.value)}
                                placeholder="Email"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="text"
                                value={editableCustomerCompany}
                                onChange={(e) => setEditableCustomerCompany(e.target.value)}
                                placeholder="Company / Address"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <p className="text-xs text-blue-700">
                                Changes will be saved when you update the job.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Pricing Section */}
                {canManage && (
                  <div className="border-t-2 border-gray-200 pt-4 space-y-4">
                    <h3 className="text-md font-semibold text-gray-900">💰 Pricing & Estimate</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pricing Type *
                        </label>
                        <select
                          name="pricingType"
                          defaultValue={editingJob?.pricingType || "FIXED"}
                          required
                          disabled={isLocked || isEmployee}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="FIXED">Fixed Price</option>
                          <option value="T&M">Time & Materials (T&M)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Estimated Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                          <input
                            name="estimatedPrice"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={editingJob?.estimatedPrice || ""}
                            placeholder="0.00"
                            disabled={isLocked || isEmployee}
                            className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Final/Agreed Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <input
                          name="finalPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={editingJob?.finalPrice || ""}
                          placeholder="0.00"
                            disabled={isLocked || isEmployee}
                            className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty until price is finalized with customer
                      </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Estimated Duration
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            name="estimatedDurationValue"
                            value={estimatedDurationValue}
                            onChange={(e) => setEstimatedDurationValue(e.target.value)}
                            placeholder="0"
                            disabled={isLocked || isEmployee}
                            className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                          <select
                            name="estimatedDurationUnit"
                            value={estimatedDurationUnit}
                            onChange={(e) =>
                              setEstimatedDurationUnit(e.target.value as any)
                            }
                            disabled={isLocked || isEmployee}
                            className="border border-gray-300 rounded-lg px-2 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="HOURS">Hours</option>
                            <option value="DAYS">Days</option>
                            <option value="WEEKS">Weeks</option>
                            <option value="MONTHS">Months</option>
                          </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Used for planning, QC, and efficiency metrics. Conversion assumes 8
                          working hours per day, 5 days per week, 4 weeks per month.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date
                  </label>
                  <input
                    name="dueDate"
                    type="date"
                    defaultValue={editingJob?.dueDate ? new Date(editingJob.dueDate).toISOString().split("T")[0] : ""}
                    disabled={isLocked || isEmployee}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingJob(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLocked || isEmployee}
                    className="flex-1 px-6 py-3 text-base sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center"
                  >
                    {editingJob ? "Update Job" : "Create Job"}
                  </button>
                </div>
            </form>
          );
        })()}
      </MobileModal>

      {/* Customer Update Confirmation Modal */}
      {showCustomerUpdateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Update Customer Information?
              </h3>
              <p className="text-sm text-gray-600">
                You are updating this customer's information. This will affect all jobs associated with this customer. Proceed?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowCustomerUpdateConfirm(false);
                  setPendingCustomerUpdate(null);
                }}
                className="flex-1 min-h-[44px] px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomerUpdateConfirm}
                className="flex-1 min-h-[44px] px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 active:bg-yellow-800 transition-colors touch-manipulation shadow-md"
              >
                Yes, Update Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && selectedJobForActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center z-[1]">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">📋 History</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedJobForActivity.title}</p>
              </div>
              <button
                onClick={() => {
                  setShowActivityModal(false);
                  setSelectedJobForActivity(null);
                  setJobActivities([]);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Lock Message */}
              {selectedJobForActivity && (selectedJobForActivity.status === "AWAITING_QC" || selectedJobForActivity.status === "COMPLETED") && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 font-medium">
                    🔒 This job has been submitted to QC and cannot be edited until returned for rework.
                  </p>
                </div>
              )}

              {/* History Feed */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">📋 History</h3>
                {loadingActivities ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Loading activities...</p>
                  </div>
                ) : jobActivities.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <div className="text-4xl mb-3">📝</div>
                    <p className="text-gray-600">No activity yet for this job</p>
                    <p className="text-gray-500 text-sm mt-1">Updates from time clock and manual notes will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {jobActivities.map((activity) => {
                      const images = activity.images ? JSON.parse(activity.images) : [];
                      return (
                        <div key={activity.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          {/* Activity Header */}
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-gray-900">
                                  {activity.user.name || activity.user.email}
                                </p>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  activity.type === "TIME_ENTRY"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}>
                                  {activity.type === "TIME_ENTRY" ? "⏰ Clock Out" : "📝 Update"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {formatDateTime(activity.createdAt)}
                              </p>
                              {activity.notes && (
                                <p className="text-sm text-gray-700 mt-2">{activity.notes}</p>
                              )}
                            </div>
                            {images.length > 0 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                📸 {images.length}
                              </span>
                            )}
                          </div>

                          {/* Photo Gallery */}
                          {images.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
                              {images.map((imgPath: string, idx: number) => {
                                // Use selectedJobForActivity and jobActivities for photo viewer
                                if (!selectedJobForActivity) return null;
                                
                                const allPhotos = getAllJobPhotos(selectedJobForActivity, jobActivities);
                                const photoIndexInAll = allPhotos.findIndex((url) => url === imgPath);
                                
                                return (
                                  <button
                                  key={idx}
                                    onClick={() => openPhotoViewer(selectedJobForActivity, photoIndexInAll >= 0 ? photoIndexInAll : idx, jobActivities)}
                                    className="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-300 hover:border-blue-500 transition-all cursor-pointer"
                                    type="button"
                                >
                                  <img
                                    src={imgPath}
                                    alt={`Photo ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 text-white text-xl">🔍</span>
                                  </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Materials & Expenses Modal */}
      {showMaterialsAndExpensesModal && selectedJobForMaterialsAndExpenses && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 z-[1]">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">📦💵 Materials & Expenses</h2>
                  <p className="text-sm text-gray-600 mt-1">{selectedJobForMaterialsAndExpenses.title}</p>
                </div>
                <button
                  onClick={() => {
                    setShowMaterialsAndExpensesModal(false);
                    setSelectedJobForMaterialsAndExpenses(null);
                    setJobMaterialRequests([]);
                    setJobExpenses([]);
                    setMaterialItemName("");
                    setMaterialQuantity(1);
                    setMaterialUnit("pcs");
                    setMaterialDescription("");
                    setMaterialPriority("MEDIUM");
                    setMaterialNotes("");
                    setExpenseCategory("Materials");
                    setExpenseDescription("");
                    setExpenseAmount("");
                    setExpenseQuantity("1");
                    setExpenseUnit("");
                    setExpenseNotes("");
                    setExpenseReceiptUrl(null);
                    setShowReceiptScanner(false);
                    setActiveTab("materials");
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
              
              {/* Tab Navigation */}
              <div className="flex gap-2 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("materials")}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                    activeTab === "materials"
                      ? "border-green-500 text-green-700"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  📦 Request Materials
                </button>
                <button
                  onClick={() => setActiveTab("expenses")}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                    activeTab === "expenses"
                      ? "border-rose-500 text-rose-700"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  💵 Report Expense
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                    activeTab === "history"
                      ? "border-indigo-500 text-indigo-700"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  📋 History
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Lock Message */}
              {selectedJobForMaterialsAndExpenses.status === "AWAITING_QC" || selectedJobForMaterialsAndExpenses.status === "COMPLETED" ? (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 font-medium">
                    🔒 This job has been submitted to QC and cannot be edited until returned for rework.
                  </p>
                </div>
              ) : null}

              {/* Tab 1: Request Materials */}
              {activeTab === "materials" && (
                <>
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">➕ Request New Material</h3>
                    <form onSubmit={handleMaterialRequest} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Item Name *
                          </label>
                          <input
                            type="text"
                            value={materialItemName}
                            onChange={(e) => setMaterialItemName(e.target.value)}
                            placeholder="e.g., Steel Handrail, Concrete Mix"
                            required
                            disabled={selectedJobForMaterialsAndExpenses.status === "AWAITING_QC" || selectedJobForMaterialsAndExpenses.status === "COMPLETED"}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Priority
                          </label>
                          <select
                            value={materialPriority}
                            onChange={(e) => setMaterialPriority(e.target.value)}
                            disabled={selectedJobForMaterialsAndExpenses.status === "AWAITING_QC" || selectedJobForMaterialsAndExpenses.status === "COMPLETED"}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="LOW">Low - Can wait</option>
                            <option value="MEDIUM">Medium - Normal priority</option>
                            <option value="HIGH">High - Needed soon</option>
                            <option value="URGENT">Urgent - Needed immediately</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quantity *
                          </label>
                          <input
                            type="number"
                            value={materialQuantity}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || (value.length <= 1 && /^[1-9]$/.test(value))) {
                                setMaterialQuantity(value === "" ? 1 : Number(value));
                              } else {
                                e.target.value = materialQuantity.toString();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                                e.preventDefault();
                              }
                            }}
                            onBlur={(e) => {
                              const numValue = Number(e.target.value);
                              if (isNaN(numValue) || numValue < 1) {
                                setMaterialQuantity(1);
                              } else if (numValue > 9) {
                                setMaterialQuantity(9);
                              } else {
                                setMaterialQuantity(Math.floor(numValue));
                              }
                            }}
                            min="1"
                            max="9"
                            step="1"
                            maxLength={1}
                            required
                            disabled={selectedJobForMaterialsAndExpenses.status === "AWAITING_QC" || selectedJobForMaterialsAndExpenses.status === "COMPLETED"}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
                          <input
                            type="text"
                            value={materialUnit}
                            onChange={(e) => setMaterialUnit(e.target.value)}
                            placeholder="pcs, kg, lbs"
                            required
                            disabled={selectedJobForMaterialsAndExpenses.status === "AWAITING_QC" || selectedJobForMaterialsAndExpenses.status === "COMPLETED"}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={materialDescription}
                          onChange={(e) => setMaterialDescription(e.target.value)}
                          placeholder="Additional details about the material needed..."
                          rows={3}
                          disabled={selectedJobForMaterialsAndExpenses.status === "AWAITING_QC" || selectedJobForMaterialsAndExpenses.status === "COMPLETED"}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Notes
                        </label>
                        <textarea
                          value={materialNotes}
                          onChange={(e) => setMaterialNotes(e.target.value)}
                          placeholder="Any additional notes or requirements..."
                          rows={2}
                          disabled={selectedJobForMaterialsAndExpenses.status === "AWAITING_QC" || selectedJobForMaterialsAndExpenses.status === "COMPLETED"}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={
                          submittingMaterial ||
                          !materialItemName ||
                          selectedJobForMaterialsAndExpenses.status === "AWAITING_QC" ||
                          selectedJobForMaterialsAndExpenses.status === "COMPLETED"
                        }
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {submittingMaterial ? "Submitting..." : "Submit Material Request"}
                      </button>
                    </form>
                  </div>

                  {/* Material Requests List */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Material Requests</h3>
                    {loadingMaterials ? (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                        <p className="text-gray-600 mt-4">Loading material requests...</p>
                      </div>
                    ) : jobMaterialRequests.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <div className="text-4xl mb-3">📦</div>
                        <p className="text-gray-600">No material requests yet for this job</p>
                        <p className="text-gray-500 text-sm mt-1">Submit your first material request above</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {jobMaterialRequests.map((request) => (
                          <div key={request.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-gray-900">{request.itemName}</p>
                                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    request.priority === "URGENT"
                                      ? "bg-red-100 text-red-700"
                                      : request.priority === "HIGH"
                                      ? "bg-orange-100 text-orange-700"
                                      : request.priority === "MEDIUM"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-green-100 text-green-700"
                                  }`}>
                                    {request.priority}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    request.status === "FULFILLED"
                                      ? "bg-green-100 text-green-700"
                                      : request.status === "APPROVED"
                                      ? "bg-blue-100 text-blue-700"
                                      : request.status === "REJECTED"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-700"
                                  }`}>
                                    {request.status}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                  Quantity: <span className="font-medium">{request.quantity} {request.unit}</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  Requested by {request.user.name || request.user.email} • {formatDateTime(request.requestedDate)}
                                </p>
                                {request.description && (
                                  <p className="text-sm text-gray-700 mt-2">{request.description}</p>
                                )}
                                {request.notes && (
                                  <p className="text-sm text-gray-600 mt-1 italic">"{request.notes}"</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Tab 2: Report Expense */}
              {activeTab === "expenses" && (
                <>
                  <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">➕ Report Expense</h3>
                    <form onSubmit={handleAddExpense} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category *
                          </label>
                          <select
                            value={expenseCategory}
                            onChange={(e) => setExpenseCategory(e.target.value)}
                            className="w-full border-2 border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors bg-white min-h-[44px]"
                            required
                          >
                            <option value="Materials">Materials</option>
                            <option value="Equipment">Equipment</option>
                            <option value="Subcontractor">Subcontractor</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount *
                          </label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full border-2 border-gray-300 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors bg-white min-h-[44px]"
                                required
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowReceiptScanner(true)}
                              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium min-h-[44px] whitespace-nowrap"
                              title="Scan receipt to auto-fill amount"
                            >
                              📷 Scan Receipt
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Receipt Preview */}
                      {expenseReceiptUrl && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Receipt
                          </label>
                          <div className="flex items-center gap-3 p-3 bg-gray-50 border-2 border-gray-200 rounded-xl">
                            <img
                              src={expenseReceiptUrl}
                              alt="Receipt"
                              className="w-20 h-20 object-cover rounded-lg border border-gray-300"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">Receipt attached</p>
                              <p className="text-xs text-gray-500">Click to view full size</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setExpenseReceiptUrl(null);
                                if (!expenseAmount) {
                                  setExpenseAmount("");
                                }
                              }}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description *
                        </label>
                        <input
                          type="text"
                          value={expenseDescription}
                          onChange={(e) => setExpenseDescription(e.target.value)}
                          placeholder="e.g., Steel bars, Welding supplies"
                          className="w-full border-2 border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors bg-white min-h-[44px]"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quantity
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={expenseQuantity}
                            onChange={(e) => setExpenseQuantity(e.target.value)}
                            placeholder="1"
                            className="w-full border-2 border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors bg-white min-h-[44px]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={expenseUnit}
                            onChange={(e) => setExpenseUnit(e.target.value)}
                            placeholder="pcs, kg, lbs, hours"
                            className="w-full border-2 border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors bg-white min-h-[44px]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Notes
                        </label>
                        <textarea
                          value={expenseNotes}
                          onChange={(e) => setExpenseNotes(e.target.value)}
                          placeholder="Additional notes about this expense..."
                          rows={3}
                          className="w-full border-2 border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors bg-white resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={addingExpense || !expenseDescription || !expenseAmount}
                        className="w-full bg-gradient-to-r from-rose-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:from-rose-700 hover:to-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md min-h-[44px]"
                      >
                        {addingExpense ? "Adding..." : "Add Expense"}
                      </button>
                    </form>
                  </div>

                  {/* Expenses List */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Expenses</h3>
                    {loadingExpenses ? (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto"></div>
                        <p className="text-gray-600 mt-4">Loading expenses...</p>
                      </div>
                    ) : jobExpenses.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-xl">
                        <div className="text-4xl mb-3">💵</div>
                        <p className="text-gray-600">No expenses recorded yet for this job</p>
                        <p className="text-gray-500 text-sm mt-1">Add your first expense above</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(() => {
                          const totalExpenses = jobExpenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
                          const revenue = selectedJobForMaterialsAndExpenses.finalPrice || selectedJobForMaterialsAndExpenses.estimatedPrice || 0;
                          const profit = revenue - totalExpenses;
                          
                          return (
                            <>
                              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-4 mb-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider mb-1">Total Expenses</p>
                                    <p className="text-xl font-bold text-indigo-900">${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Revenue</p>
                                    <p className="text-xl font-bold text-blue-900">${revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                  </div>
                                  <div>
                                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>Profit</p>
                                    <p className={`text-xl font-bold ${profit >= 0 ? "text-emerald-900" : "text-red-900"}`}>${profit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                  </div>
                                </div>
                              </div>
                              {jobExpenses.map((expense: any) => (
                                <div key={expense.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition-colors shadow-sm">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-gray-900">{expense.description}</p>
                                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-rose-100 text-rose-700">
                                          {expense.category}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-600">
                                        {expense.quantity && expense.quantity !== 1 && (
                                          <span>{expense.quantity} {expense.unit || ""} × </span>
                                        )}
                                        <span className="font-semibold text-gray-900">${expense.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </p>
                                      {expense.notes && (
                                        <p className="text-sm text-gray-600 mt-1 italic">"{expense.notes}"</p>
                                      )}
                                      {expense.receiptUrl && (
                                        <div className="mt-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPhotoViewerPhotos([expense.receiptUrl]);
                                              setPhotoViewerIndex(0);
                                              setShowPhotoViewer(true);
                                            }}
                                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                          >
                                            📷 View Receipt
                                          </button>
                                        </div>
                                      )}
                                      <p className="text-xs text-gray-500 mt-1">
                                        Added by {expense.user?.name || "Unknown"} • {formatDateTime(expense.expenseDate || expense.createdAt)}
                                      </p>
                                    </div>
                                    {canManage && (
                                      <button
                                        onClick={() => handleDeleteExpense(expense.id)}
                                        className="ml-4 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors text-sm font-medium min-h-[44px]"
                                        title="Delete expense"
                                      >
                                        🗑️
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Tab 3: History (Unified View) */}
              {activeTab === "history" && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Complete History</h3>
                  {loadingMaterials || loadingExpenses ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="text-gray-600 mt-4">Loading history...</p>
                    </div>
                  ) : jobMaterialRequests.length === 0 && jobExpenses.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                      <div className="text-4xl mb-3">📋</div>
                      <p className="text-gray-600">No materials or expenses recorded yet</p>
                      <p className="text-gray-500 text-sm mt-1">Use the tabs above to add materials or expenses</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Combine and sort by date */}
                      {[
                        ...jobMaterialRequests.map((req: any) => ({
                          ...req,
                          type: "material",
                          date: new Date(req.requestedDate).getTime(),
                        })),
                        ...jobExpenses.map((exp: any) => ({
                          ...exp,
                          type: "expense",
                          date: new Date(exp.expenseDate || exp.createdAt).getTime(),
                        })),
                      ]
                        .sort((a, b) => b.date - a.date)
                        .map((item: any) => {
                          if (item.type === "material") {
                            return (
                              <div key={item.id} className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                  <div className="text-2xl">📦</div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-semibold text-gray-900">{item.itemName}</p>
                                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
                                        Material Request
                                      </span>
                                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                        item.status === "FULFILLED"
                                          ? "bg-green-100 text-green-700"
                                          : item.status === "APPROVED"
                                          ? "bg-blue-100 text-blue-700"
                                          : item.status === "REJECTED"
                                          ? "bg-red-100 text-red-700"
                                          : "bg-gray-100 text-gray-700"
                                      }`}>
                                        {item.status}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">
                                      Quantity: <span className="font-medium">{item.quantity} {item.unit}</span>
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Requested by {item.user.name || item.user.email} • {formatDateTime(item.requestedDate)}
                                    </p>
                                    {item.description && (
                                      <p className="text-sm text-gray-700 mt-2">{item.description}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div key={item.id} className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                  <div className="text-2xl">💵</div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-semibold text-gray-900">{item.description}</p>
                                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-rose-100 text-rose-700">
                                        Expense
                                      </span>
                                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700">
                                        {item.category}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">
                                      {item.quantity && item.quantity !== 1 && (
                                        <span>{item.quantity} {item.unit || ""} × </span>
                                      )}
                                      <span className="font-semibold text-gray-900">${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Added by {item.user?.name || "Unknown"} • {formatDateTime(item.expenseDate || item.createdAt)}
                                    </p>
                                    {item.receiptUrl && (
                                      <div className="mt-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPhotoViewerPhotos([item.receiptUrl]);
                                            setPhotoViewerIndex(0);
                                            setShowPhotoViewer(true);
                                          }}
                                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                          📷 View Receipt
                                        </button>
                                      </div>
                                    )}
                                    {item.notes && (
                                      <p className="text-sm text-gray-600 mt-1 italic">"{item.notes}"</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quotation Modal */}
      {showQuotationModal && selectedJobForQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 no-print print-area-container overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div ref={quotationRef}>
              {/* Estimate Header */}
              <div className="p-6 border-b bg-gray-50 no-print">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {currentQuotationId ? "Edit Quotation" : "Create Quotation"}
                    </h2>
                    {autoSavingQuotation && (
                      <span className="text-sm text-gray-500">Auto-saving...</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadQuotationPDF}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      📥 Download PDF
                    </button>
                    <button
                      onClick={() => {
                        setShowQuotationModal(false);
                        setSelectedJobForQuotation(null);
                        setQuotationLineItems([]);
                        setCurrentQuotationId(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              {/* Estimate Content */}
              <div className="p-8 print-area">
                {/* Company Header */}
                <div className="mb-8 pb-6 border-b-2 border-gray-300">
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">ESTIMATE</h1>
                  {companySettings && (
                    <div className="text-gray-600">
                      <p className="font-semibold text-lg">{companySettings.companyName}</p>
                      {companySettings.address && <p>{companySettings.address}</p>}
                      {(companySettings.city || companySettings.state || companySettings.zipCode) && (
                        <p>
                          {companySettings.city}{companySettings.city && companySettings.state ? ", " : ""}{companySettings.state} {companySettings.zipCode}
                        </p>
                      )}
                      {companySettings.phone && <p>Phone: {companySettings.phone}</p>}
                      {companySettings.email && <p>Email: {companySettings.email}</p>}
                    </div>
                  )}
                </div>

                {/* Estimate Details Grid */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  {/* Quote For */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Quote For:</h3>
                    {selectedJobForQuotation.customer ? (
                      <div className="text-gray-900">
                        <p className="font-semibold">{selectedJobForQuotation.customer.name}</p>
                        {selectedJobForQuotation.customer.company && (
                          <p>{selectedJobForQuotation.customer.company}</p>
                        )}
                        {selectedJobForQuotation.customer.phone && (
                          <p>{selectedJobForQuotation.customer.phone}</p>
                        )}
                        {selectedJobForQuotation.customer.email && (
                          <p>{selectedJobForQuotation.customer.email}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No customer assigned</p>
                    )}
                  </div>

                  {/* Estimate Info */}
                  <div className="text-right">
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <span className="text-gray-600 text-right">Date:</span>
                        <input
                          type="date"
                          value={quotationDate}
                          onChange={(e) => {
                            setQuotationDate(e.target.value);
                            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                            autoSaveTimeoutRef.current = setTimeout(() => handleAutoSaveQuotation(), 2000);
                          }}
                          className="font-semibold text-right border-b border-gray-300 focus:border-green-500 outline-none print-no-border"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <span className="text-gray-600 text-right">Valid Until:</span>
                        <input
                          type="date"
                          value={quotationValidUntil}
                          onChange={(e) => {
                            setQuotationValidUntil(e.target.value);
                            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                            autoSaveTimeoutRef.current = setTimeout(() => handleAutoSaveQuotation(), 2000);
                          }}
                          className="font-semibold text-right border-b border-gray-300 focus:border-green-500 outline-none print-no-border"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <span className="text-gray-600 text-right">Job:</span>
                        <span className="font-semibold text-right">{selectedJobForQuotation.title}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="mb-8">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-indigo-600 to-blue-600">
                        <th className="border border-gray-300 px-4 py-3 text-left text-sm font-bold text-black uppercase tracking-wider whitespace-nowrap">Description</th>
                        <th className="border border-gray-300 px-4 py-3 text-center text-sm font-bold text-black uppercase tracking-wider whitespace-nowrap w-24">Qty</th>
                        <th className="border border-gray-300 px-4 py-3 text-right text-sm font-bold text-black uppercase tracking-wider whitespace-nowrap w-32">Rate</th>
                        <th className="border border-gray-300 px-4 py-3 text-right text-sm font-bold text-black uppercase tracking-wider whitespace-nowrap w-32">Amount</th>
                        <th className="border border-gray-300 px-4 py-3 text-center text-sm font-bold text-black uppercase tracking-wider whitespace-nowrap w-20 no-print">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationLineItems.map((item, index) => (
                        <tr key={index}>
                          <td className="border border-gray-300 px-4 py-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateQuotationLineItem(index, "description", e.target.value)}
                              className="w-full outline-none print-no-border"
                              placeholder="Description"
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuotationLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                              className="w-full text-center outline-none print-no-border"
                              step="0.01"
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right">
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => updateQuotationLineItem(index, "rate", parseFloat(e.target.value) || 0)}
                              className="w-full text-right outline-none print-no-border"
                              step="0.01"
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                            ${item.amount.toFixed(2)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center no-print">
                            <button
                              onClick={() => removeQuotationLineItem(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <button
                    onClick={addQuotationLineItem}
                    className="mt-4 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors no-print"
                  >
                    + Add Line Item
                  </button>
                </div>

                {/* Total */}
                <div className="flex justify-end mb-8">
                  <div className="w-64">
                    <div className="flex justify-between py-2 border-b border-gray-300">
                      <span className="font-semibold">Subtotal:</span>
                      <span>${calculateQuotationSubtotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-300">
                      <span className="font-semibold">Shipping Fee:</span>
                      <input
                        type="number"
                        value={quotationShippingFee}
                        onChange={(e) => {
                          setQuotationShippingFee(parseFloat(e.target.value) || 0);
                          if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                          autoSaveTimeoutRef.current = setTimeout(() => handleAutoSaveQuotation(), 2000);
                        }}
                        className="w-20 text-right border-b border-gray-300 focus:border-green-500 outline-none"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="flex justify-between py-3 border-t-2 border-green-600">
                      <span className="text-lg font-bold">Total:</span>
                      <span className="text-lg font-bold text-green-600">${calculateQuotationTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Prepared By */}
                <div className="mb-8 no-print">
                  <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">Prepared By:</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={quotationPreparedByName}
                        onChange={(e) => {
                          setQuotationPreparedByName(e.target.value);
                          if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                          autoSaveTimeoutRef.current = setTimeout(() => handleAutoSaveQuotation(), 2000);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Prepared By Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={quotationPreparedByTitle}
                        onChange={(e) => {
                          setQuotationPreparedByTitle(e.target.value);
                          if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                          autoSaveTimeoutRef.current = setTimeout(() => handleAutoSaveQuotation(), 2000);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Title/Position"
                      />
                    </div>
                  </div>
                </div>

                {/* Terms & Notes */}
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Terms & Conditions:</h3>
                  <textarea
                    value={quotationNotes}
                    onChange={(e) => {
                      setQuotationNotes(e.target.value);
                      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                      autoSaveTimeoutRef.current = setTimeout(() => handleAutoSaveQuotation(), 2000);
                    }}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none print-no-border"
                    placeholder="Add any terms, conditions, or notes..."
                  />
                </div>

                {/* Footer */}
                <div className="text-center text-gray-500 text-sm border-t pt-6">
                  <p className="font-semibold">Thank you for your business!</p>
                </div>
              </div>

              {/* Actions - Save and Cancel at bottom */}
              <div className="p-6 border-t bg-gray-50 no-print">
                <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuotationModal(false);
                      setSelectedJobForQuotation(null);
                      setQuotationLineItems([]);
                      setCurrentQuotationId(null);
                    }}
                    className="px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-semibold text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveQuotation}
                    disabled={savingQuotation}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {savingQuotation ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            margin: 0.5in;
            size: letter;
          }
          
          /* Hide everything except print area */
          body > *:not(.print-area-container) {
            display: none !important;
          }
          
          /* Show the modal container when printing */
          .print-area-container {
            display: block !important;
            position: static !important;
            background: white !important;
            box-shadow: none !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Show print area */
          .print-area {
            display: block !important;
            position: static !important;
            width: 100% !important;
            background: white !important;
            padding: 0.5in !important;
            margin: 0 !important;
          }
          
          /* Hide non-printable elements */
          .no-print {
            display: none !important;
          }
          
          /* Remove borders from inputs when printing */
          .print-no-border {
            border: none !important;
            box-shadow: none !important;
            outline: none !important;
            background: transparent !important;
            appearance: none !important;
            -webkit-appearance: none !important;
          }
          
          /* Ensure clean print */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          
          /* Hide any remaining UI elements */
          header, nav, footer, button, .no-print, 
          .fixed, [class*="fixed"], 
          [class*="modal"], [class*="overlay"] {
            display: none !important;
          }
          
          /* Ensure table prints properly */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 0 !important;
          }
          
          th, td {
            border: 1px solid #000 !important;
            padding: 8px !important;
          }
          
          /* Remove any transforms or filters */
          * {
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>

      {/* Photo Viewer Modal */}
      {showPhotoViewer && (
        <PhotoViewerModal
          photos={photoViewerPhotos}
          initialIndex={photoViewerIndex}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}

      {/* Receipt Scanner Modal */}
      {showReceiptScanner && selectedJobForMaterialsAndExpenses && session?.user && (
        <ReceiptScanner
          jobId={selectedJobForMaterialsAndExpenses.id}
          userId={(session.user as any).id}
          onScanComplete={handleReceiptScanComplete}
          onCancel={() => setShowReceiptScanner(false)}
        />
      )}
    </main>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    }>
      <JobsPageContent />
    </Suspense>
  );
}

