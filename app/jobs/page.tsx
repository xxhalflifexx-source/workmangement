"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { getJobs, getAllUsers, createJob, updateJob, deleteJob, getJobActivities, addJobActivity, getAllCustomers, createCustomer, saveJobPhotos, submitJobPhotosToQC, getJobPhotos, removeJobPhoto as removeJobPhotoFromDB } from "./actions";
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
import { formatDateShort, formatDateTime, formatDateInput, todayCentralISO, nowInCentral, centralToUTC } from "@/lib/date-utils";

interface Job {
  id: string;
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
  
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  
  // Initialize search params after component mounts
  const [searchInitialized, setSearchInitialized] = useState(false);
  
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerCompany, setNewCustomerCompany] = useState("");
  
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedJobForActivity, setSelectedJobForActivity] = useState<Job | null>(null);
  const [jobActivities, setJobActivities] = useState<JobActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  const [newActivityNotes, setNewActivityNotes] = useState("");
  const [newActivityFiles, setNewActivityFiles] = useState<File[]>([]);
  const [addingActivity, setAddingActivity] = useState(false);
  
  // Photo upload states per job
  const [jobPhotoFiles, setJobPhotoFiles] = useState<Record<string, File[]>>({});
  const [savingPhotos, setSavingPhotos] = useState<Record<string, boolean>>({});
  const [jobExistingPhotos, setJobExistingPhotos] = useState<Record<string, Array<{ id: string; url: string; activityId: string }>>>({});
  const [removingPhotos, setRemovingPhotos] = useState<Record<string, boolean>>({});
  
  // Photo viewer modal state
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedJobForMaterial, setSelectedJobForMaterial] = useState<Job | null>(null);
  const [jobMaterialRequests, setJobMaterialRequests] = useState<MaterialRequest[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  
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
  const [savedQuotations, setSavedQuotations] = useState<any[]>([]);
  const [showSavedQuotations, setShowSavedQuotations] = useState(false);
  const quotationRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedDataRef = useRef(false);

  // Initialize search params from URL
  useEffect(() => {
    if (searchParams && !searchInitialized) {
      setSearchQuery(searchParams.get("q") || "");
      setFilterStatus(searchParams.get("status") || "ALL");
      setSearchInitialized(true);
    }
  }, [searchParams, searchInitialized]);

  // Load data when session is ready
  useEffect(() => {
    if (sessionStatus === "loading") {
      return; // Wait for session to load
    }
    
    if (!session?.user) {
      setLoading(false);
      setError("Please log in to view jobs");
      hasLoadedDataRef.current = false; // Reset so it can load when user logs in
      return;
    }

    // Only load data once on initial mount when session is ready
    if (hasLoadedDataRef.current) {
      return;
    }

    hasLoadedDataRef.current = true;

    // Calculate canManage based on current session
    const currentCanManage = (session?.user as any)?.role === "MANAGER" || (session?.user as any)?.role === "ADMIN";
    
    // Load data once session is ready
    const fetchData = async () => {
      setLoading(true);
      setError(undefined);
      try {
        console.log("Loading jobs data...");
        const [jobsRes, usersRes, customersRes] = await Promise.all([
          getJobs(),
          currentCanManage ? getAllUsers() : Promise.resolve({ ok: true, users: [] }),
          currentCanManage ? getAllCustomers() : Promise.resolve({ ok: true, customers: [] }),
        ]);

        if (jobsRes.ok) {
          const jobsData = jobsRes.jobs as any;
          console.log(`Loaded ${jobsData.length} jobs`);
          setJobs(jobsData);

          // Extract photos from activities for each job
          const photosMap: Record<string, Array<{ id: string; url: string; activityId: string }>> = {};
          jobsData.forEach((job: any) => {
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
        } else {
          console.error("Failed to load jobs:", jobsRes.error);
          setError(jobsRes.error || "Failed to load jobs");
        }

        if (usersRes.ok) {
          setUsers(usersRes.users as any);
        }

        if (customersRes.ok) {
          setCustomers(customersRes.customers as any);
        }
      } catch (err) {
        console.error("Error loading jobs data:", err);
        setError("Failed to load jobs. Please try refreshing the page.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionStatus, session]);

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

  const loadData = async () => {
    // Calculate canManage from current session state
    const currentCanManage = (session?.user as any)?.role === "MANAGER" || (session?.user as any)?.role === "ADMIN";
    
    setLoading(true);
    setError(undefined);
    try {
      console.log("Reloading jobs data...");
      const [jobsRes, usersRes, customersRes] = await Promise.all([
        getJobs(),
        currentCanManage ? getAllUsers() : Promise.resolve({ ok: true, users: [] }),
        currentCanManage ? getAllCustomers() : Promise.resolve({ ok: true, customers: [] }),
      ]);

      if (jobsRes.ok) {
        const jobsData = jobsRes.jobs as any;
        console.log(`Reloaded ${jobsData.length} jobs`);
        setJobs(jobsData);

        // Extract photos from activities for each job
        const photosMap: Record<string, Array<{ id: string; url: string; activityId: string }>> = {};
        jobsData.forEach((job: any) => {
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
      } else {
        console.error("Failed to reload jobs:", jobsRes.error);
        setError(jobsRes.error || "Failed to load jobs");
      }

      if (usersRes.ok) {
        setUsers(usersRes.users as any);
      }

      if (customersRes.ok) {
        setCustomers(customersRes.customers as any);
      }
    } catch (err) {
      console.error("Error loading jobs data:", err);
      setError("Failed to load jobs. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

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

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobForActivity) return;

    // Prevent adding activities if job is locked
    if (selectedJobForActivity.status === "AWAITING_QC" || selectedJobForActivity.status === "COMPLETED") {
      setError("This job has been submitted to QC and cannot be edited until returned for rework.");
      return;
    }

    setAddingActivity(true);
    setError(undefined);

    let imagePaths: string[] = [];

    // Upload images if any selected
    if (newActivityFiles.length > 0) {
      try {
        const formData = new FormData();
        newActivityFiles.forEach((file) => formData.append("files", file));

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          imagePaths = data.paths || [];
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    const formData = new FormData();
    formData.append("jobId", selectedJobForActivity.id);
    formData.append("notes", newActivityNotes);
    if (imagePaths.length > 0) {
      formData.append("images", JSON.stringify(imagePaths));
    }

    const res = await addJobActivity(formData);
    if (res.ok) {
      setNewActivityNotes("");
      setNewActivityFiles([]);
      setSuccess("Activity added successfully!");
      // Refresh activities
      openActivityModal(selectedJobForActivity);
    } else {
      setError(res.error);
    }

    setAddingActivity(false);
  };

  const handleActivityFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewActivityFiles((prev) => [...prev, ...files]);
  };

  const removeActivityFile = (index: number) => {
    setNewActivityFiles((prev) => prev.filter((_, i) => i !== index));
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

  const openMaterialModal = async (job: Job) => {
    setSelectedJobForMaterial(job);
    setShowMaterialModal(true);
    setLoadingMaterials(true);
    
    const res = await getJobMaterialRequests(job.id);
    if (res.ok) {
      setJobMaterialRequests(res.requests as any);
    } else {
      setError(res.error);
    }
    setLoadingMaterials(false);
  };

  const handleMaterialRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobForMaterial) return;

    // Prevent creating material requests if job is locked
    if (selectedJobForMaterial.status === "AWAITING_QC" || selectedJobForMaterial.status === "COMPLETED") {
      setError("This job has been submitted to QC and cannot be edited until returned for rework.");
      return;
    }

    setSubmittingMaterial(true);
    setError(undefined);

    const formData = new FormData();
    formData.append("jobId", selectedJobForMaterial.id);
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
    
    // Refresh material requests
    openMaterialModal(selectedJobForMaterial);
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



  // Quotation Functions
  const openQuotationModal = async (job: Job) => {
    if (!canManage) {
      setError("Only managers and admins can create quotations");
      return;
    }

    setSelectedJobForQuotation(job);
    setShowQuotationModal(true);
    setCurrentQuotationId(null); // New quotation
    
    // Load saved quotations for this job
    const quotationsRes = await getQuotationsByJobId(job.id);
    if (quotationsRes.ok) {
      setSavedQuotations(quotationsRes.quotations || []);
    }
    
    setQuotationDate(todayCentralISO());
    
    // Set valid until date to 30 days from now in Central Time
    const validUntil = nowInCentral().add(30, 'day');
    setQuotationValidUntil(validUntil.format('YYYY-MM-DD'));
    
    // Load company settings if not already loaded
    if (!companySettings) {
      const settings = await getCompanySettingsForInvoice();
    setCompanySettings(settings);
    }
    
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
    
    // Auto-save after a short delay
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSaveQuotation();
    }, 2000); // Auto-save after 2 seconds of inactivity
  };
  
  const openQuotationForEdit = async (quotation: any) => {
    if (!selectedJobForQuotation) return;
    
    setCurrentQuotationId(quotation.id);
    setQuotationDate(quotation.issueDate ? formatDateInput(new Date(quotation.issueDate)) : todayCentralISO());
    setQuotationValidUntil(quotation.validUntil ? formatDateInput(new Date(quotation.validUntil)) : "");
    setQuotationLineItems(quotation.lines || []);
    setQuotationNotes(quotation.notes || "");
    setQuotationShippingFee(quotation.shippingFee || 0);
    setQuotationPaymentBank(quotation.paymentBank || "");
    setQuotationPaymentAccountName(quotation.paymentAccountName || "");
    setQuotationPaymentAccountNumber(quotation.paymentAccountNumber || "");
    setQuotationPreparedByName(quotation.preparedByName || "");
    setQuotationPreparedByTitle(quotation.preparedByTitle || "");
    setQuotationCustomerName(quotation.customerName || "");
    setQuotationCustomerAddress(quotation.customerAddress || "");
    setQuotationCustomerPhone(quotation.customerPhone || "");
    setQuotationCustomerEmail(quotation.customerEmail || "");
    setShowSavedQuotations(false);
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
        // Reload saved quotations
        const quotationsRes = await getQuotationsByJobId(selectedJobForQuotation.id);
        if (quotationsRes.ok) {
          setSavedQuotations(quotationsRes.quotations || []);
        }
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
        // Reload saved quotations
        const quotationsRes = await getQuotationsByJobId(selectedJobForQuotation.id);
        if (quotationsRes.ok) {
          setSavedQuotations(quotationsRes.quotations || []);
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

  const handleDownloadQuotationPDF = () => {
    if (!selectedJobForQuotation || !companySettings) {
      setError("Job data or company settings not loaded");
      return;
    }

    const subtotal = calculateQuotationSubtotal();
    const total = calculateQuotationTotal();

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

    const pdf = generateQuotationPDF(pdfData);
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

  // Get filter values from URL params (with fallback to state)
  const statusFilter = searchParams?.get("status") || filterStatus || "ALL";
  const customerFilter = searchParams?.get("customer") || "";
  const workerFilter = searchParams?.get("worker") || "";
  const dateFrom = searchParams?.get("dateFrom") || "";
  const dateTo = searchParams?.get("dateTo") || "";
  const search = searchParams?.get("q") || searchQuery || "";

  const filteredJobs = jobs.filter((job) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        job.title.toLowerCase().includes(searchLower) ||
        job.description?.toLowerCase().includes(searchLower) ||
        job.customer?.name.toLowerCase().includes(searchLower) ||
        job.id.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== "ALL" && job.status !== statusFilter) return false;

    // Priority filter (keep for backward compatibility)
    if (filterPriority !== "ALL" && job.priority !== filterPriority) return false;

    // Customer filter
    if (customerFilter && job.customer?.id !== customerFilter) return false;

    // Worker filter
    if (workerFilter) {
      const matchesWorker =
        job.assignee?.id === workerFilter ||
        (job as any).timeEntries?.some((te: any) => te.user?.id === workerFilter);
      if (!matchesWorker) return false;
    }

    // Date filters
    if (dateFrom || dateTo) {
      const jobDate = new Date(job.createdAt);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (jobDate < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (jobDate > toDate) return false;
      }
    }

    return true;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No due date";
    return formatDateShort(dateString);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Job Management</h1>
            <p className="text-xs sm:text-sm text-gray-500">View and manage all jobs</p>
          </div>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
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
        <form
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6"
          action="/jobs"
          method="GET"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Search by job title, description, customer, or job number..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-gray-100 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-200"
            >
              Search
            </button>
          </div>
          {/* preserve filters when searching */}
          {statusFilter && statusFilter !== "ALL" && (
            <input type="hidden" name="status" value={statusFilter} />
          )}
          {customerFilter && <input type="hidden" name="customer" value={customerFilter} />}
          {workerFilter && <input type="hidden" name="worker" value={workerFilter} />}
          {dateFrom && <input type="hidden" name="dateFrom" value={dateFrom} />}
          {dateTo && <input type="hidden" name="dateTo" value={dateTo} />}
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="w-full md:w-auto min-h-[44px] bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + Create Job
            </button>
          )}
        </form>

        {/* Filters */}
        {canManage && (
          <JobFilters customers={customers} users={users} />
        )}

        {/* Jobs Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading jobs...</div>
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
          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Workers
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deadline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Photo Thumbnail
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredJobs.map((job) => (
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
                      onMaterial={openMaterialModal}
                      onQuotation={openQuotationModal}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {editingJob ? "Edit Job" : "Create New Job"}
              </h2>
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
              <form onSubmit={handleSubmit} className="space-y-4">
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        Assign to
                      </label>
                      <select
                        name="assignedTo"
                        defaultValue={editingJob?.assignee ? (editingJob as any).assignedTo : ""}
                        disabled={isLocked || isEmployee}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Unassigned</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.role})
                          </option>
                        ))}
                      </select>
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
                        <select
                          name="customerId"
                          defaultValue={editingJob?.customer?.id || ""}
                          disabled={isLocked || isEmployee}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">No Customer</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name} {customer.company && `(${customer.company})`}
                            </option>
                          ))}
                        </select>
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
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                            className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                            className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {editingJob ? "Update Job" : "Create Job"}
                  </button>
                </div>
              </form>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && selectedJobForActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">📝 Job Activity & Notes</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedJobForActivity.title}</p>
              </div>
              <button
                onClick={() => {
                  setShowActivityModal(false);
                  setSelectedJobForActivity(null);
                  setJobActivities([]);
                  setNewActivityNotes("");
                  setNewActivityFiles([]);
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

              {/* Add Activity Form */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">➕ Add Update</h3>
                <form onSubmit={handleAddActivity} className="space-y-4">
                  <textarea
                    value={newActivityNotes}
                    onChange={(e) => setNewActivityNotes(e.target.value)}
                    placeholder="Add notes, updates, or progress report..."
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    rows={3}
                    required={newActivityFiles.length === 0}
                    disabled={selectedJobForActivity ? (selectedJobForActivity.status === "AWAITING_QC" || selectedJobForActivity.status === "COMPLETED") : false}
                  />

                  {/* Photo Upload */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleActivityFileSelect}
                      className="hidden"
                      id="activity-photo-upload"
                      disabled={selectedJobForActivity ? (selectedJobForActivity.status === "AWAITING_QC" || selectedJobForActivity.status === "COMPLETED") : false}
                    />
                    <label
                      htmlFor="activity-photo-upload"
                      className={`inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 ${
                        selectedJobForActivity && (selectedJobForActivity.status === "AWAITING_QC" || selectedJobForActivity.status === "COMPLETED")
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer hover:bg-gray-50"
                      }`}
                    >
                      <span>📷</span>
                      Attach Photos
                    </label>

                    {newActivityFiles.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {newActivityFiles.map((file, index) => (
                          <div key={index} className="relative bg-gray-100 border border-gray-200 rounded p-2 flex items-center gap-2">
                            <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="text-xs flex-1 truncate">{file.name}</p>
                            <button
                              onClick={() => removeActivityFile(index)}
                              type="button"
                              className="text-red-500 hover:text-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={
                      addingActivity ||
                      (!newActivityNotes && newActivityFiles.length === 0) ||
                      (selectedJobForActivity ? (selectedJobForActivity.status === "AWAITING_QC" || selectedJobForActivity.status === "COMPLETED") : false)
                    }
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {addingActivity ? "Adding..." : "Add Update"}
                  </button>
                </form>
              </div>

              {/* Activity Feed */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Activity History</h3>
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

      {/* Material Request Modal */}
      {showMaterialModal && selectedJobForMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">📦 Material Requests</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedJobForMaterial.title}</p>
              </div>
              <button
                onClick={() => {
                  setShowMaterialModal(false);
                  setSelectedJobForMaterial(null);
                  setJobMaterialRequests([]);
                  setMaterialItemName("");
                  setMaterialQuantity(1);
                  setMaterialUnit("pcs");
                  setMaterialDescription("");
                  setMaterialPriority("MEDIUM");
                  setMaterialNotes("");
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Lock Message */}
              {selectedJobForMaterial && (selectedJobForMaterial.status === "AWAITING_QC" || selectedJobForMaterial.status === "COMPLETED") && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 font-medium">
                    🔒 This job has been submitted to QC and cannot be edited until returned for rework.
                  </p>
                </div>
              )}

              {/* Add Material Request Form */}
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
                        disabled={selectedJobForMaterial ? (selectedJobForMaterial.status === "AWAITING_QC" || selectedJobForMaterial.status === "COMPLETED") : false}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        value={materialPriority}
                        onChange={(e) => setMaterialPriority(e.target.value)}
                        disabled={selectedJobForMaterial ? (selectedJobForMaterial.status === "AWAITING_QC" || selectedJobForMaterial.status === "COMPLETED") : false}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                          // Only allow single digit numbers (1-9), no decimals
                          if (value === "" || (value.length <= 1 && /^[1-9]$/.test(value))) {
                            setMaterialQuantity(value === "" ? 1 : Number(value));
                          } else {
                            // If user tries to enter more than one digit or decimal, keep current value
                            e.target.value = materialQuantity.toString();
                          }
                        }}
                        onKeyDown={(e) => {
                          // Prevent decimal point, minus sign, and 'e' (scientific notation)
                          if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                            e.preventDefault();
                          }
                        }}
                        onBlur={(e) => {
                          // Ensure value is a whole number between 1-9 on blur
                          const numValue = Number(e.target.value);
                          if (isNaN(numValue) || numValue < 1) {
                            setMaterialQuantity(1);
                          } else if (numValue > 9) {
                            setMaterialQuantity(9);
                          } else {
                            setMaterialQuantity(Math.floor(numValue)); // Ensure whole number, no decimals
                          }
                        }}
                        min="1"
                        max="9"
                        step="1"
                        maxLength={1}
                        required
                        disabled={selectedJobForMaterial ? (selectedJobForMaterial.status === "AWAITING_QC" || selectedJobForMaterial.status === "COMPLETED") : false}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={selectedJobForMaterial ? (selectedJobForMaterial.status === "AWAITING_QC" || selectedJobForMaterial.status === "COMPLETED") : false}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      disabled={selectedJobForMaterial ? (selectedJobForMaterial.status === "AWAITING_QC" || selectedJobForMaterial.status === "COMPLETED") : false}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      disabled={selectedJobForMaterial ? (selectedJobForMaterial.status === "AWAITING_QC" || selectedJobForMaterial.status === "COMPLETED") : false}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      submittingMaterial ||
                      !materialItemName ||
                      (selectedJobForMaterial ? (selectedJobForMaterial.status === "AWAITING_QC" || selectedJobForMaterial.status === "COMPLETED") : false)
                    }
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {submittingMaterial ? "Submitting..." : "Submit Material Request"}
                  </button>
                </form>
              </div>

              {/* Material Requests History */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Material Request History</h3>
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
            </div>
          </div>
        </div>
      )}

      {/* Quotation Modal */}
      {showQuotationModal && selectedJobForQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 no-print print-area-container">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            <div ref={quotationRef}>
              {/* Saved Quotations List */}
              {showSavedQuotations && savedQuotations.length > 0 && (
                <div className="p-6 border-b bg-blue-50 no-print">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Saved Quotations</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {savedQuotations.map((quo) => (
                      <div
                        key={quo.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDateShort(new Date(quo.createdAt))} - ${quo.total.toFixed(2)}
              </div>
                          <div className="text-xs text-gray-500">
                            {quo.lines?.length || 0} line items
                          </div>
                        </div>
                    <div className="flex gap-2">
                      <button
                            onClick={() => openQuotationForEdit(quo)}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                            Edit
                      </button>
                      <button
                        onClick={() => {
                              const pdfData: QuotationPDFData = {
                                quotationDate: quo.issueDate ? formatDateInput(new Date(quo.issueDate)) : todayCentralISO(),
                                validUntil: quo.validUntil ? formatDateInput(new Date(quo.validUntil)) : undefined,
                                companyName: companySettings?.companyName || "TCB METAL WORKS",
                                companyAddress: companySettings?.address || undefined,
                                companyCity: companySettings?.city || undefined,
                                companyState: companySettings?.state || undefined,
                                companyZipCode: companySettings?.zipCode || undefined,
                                companyPhone: companySettings?.phone || undefined,
                                companyEmail: companySettings?.email || undefined,
                                customerName: quo.customerName || "Customer",
                                customerAddress: quo.customerAddress || undefined,
                                customerPhone: quo.customerPhone || undefined,
                                customerEmail: quo.customerEmail || undefined,
                                lineItems: quo.lines || [],
                                subtotal: (quo.total || 0) - (quo.shippingFee || 0),
                                shippingFee: quo.shippingFee || 0,
                                total: quo.total || 0,
                                notes: quo.notes || undefined,
                                paymentBank: quo.paymentBank || undefined,
                                paymentAccountName: quo.paymentAccountName || undefined,
                                paymentAccountNumber: quo.paymentAccountNumber || undefined,
                                preparedByName: quo.preparedByName || undefined,
                                preparedByTitle: quo.preparedByTitle || undefined,
                              };
                              const pdf = generateQuotationPDF(pdfData);
                              const jobTitle = selectedJobForQuotation?.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'quotation';
                              pdf.save(`quotation-${jobTitle}-${formatDateInput(new Date(quo.createdAt))}.pdf`);
                            }}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                            Download PDF
                      </button>
                    </div>
                  </div>
                    ))}
                </div>
                      </div>
                    )}

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
                    {savedQuotations.length > 0 && (
                              <button
                        onClick={() => setShowSavedQuotations(!showSavedQuotations)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                              >
                        {showSavedQuotations ? "Hide" : "View"} Saved Quotations ({savedQuotations.length})
                              </button>
            )}
          </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveQuotation}
                      disabled={savingQuotation}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {savingQuotation ? "Saving..." : "💾 Save"}
                    </button>
                    <button
                      onClick={handleDownloadQuotationPDF}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      🖨️ Download PDF
                    </button>
                    <button
                      onClick={() => {
                        setShowQuotationModal(false);
                        setSelectedJobForQuotation(null);
                        setQuotationLineItems([]);
                        setCurrentQuotationId(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Close
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
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold">Description</th>
                        <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold w-24">Qty</th>
                        <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold w-32">Rate</th>
                        <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold w-32">Amount</th>
                        <th className="border border-gray-300 px-4 py-3 text-center w-20 no-print">Action</th>
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

