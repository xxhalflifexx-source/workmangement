"use client";

import { useEffect, useState, useRef } from "react";
import { getJobs, getAllUsers, createJob, updateJob, deleteJob, getJobActivities, addJobActivity, getAllCustomers, createCustomer, saveJobPhotos, submitJobPhotosToQC, getJobPhotos, removeJobPhoto as removeJobPhotoFromDB } from "./actions";
import { createMaterialRequest, getJobMaterialRequests } from "../material-requests/actions";
import { getJobForInvoice, getCompanySettingsForInvoice } from "./invoice-actions";
import { createInvoice } from "../invoices/actions";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { generateInvoicePDF, InvoicePDFData } from "@/lib/pdf-generator";

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
  assignee: { name: string; email: string } | null;
  creator: { name: string };
  customer: { id: string; name: string; phone: string | null; email: string | null; company: string | null } | null;
  createdAt: string;
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

export default function JobsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const canManage = userRole === "MANAGER" || userRole === "ADMIN";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  
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
  
  // Invoice states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedJobForInvoice, setSelectedJobForInvoice] = useState<any>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [laborRate, setLaborRate] = useState(75);
  const [invoiceLineItems, setInvoiceLineItems] = useState<any[]>([]);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  // Editable invoice fields
  const [editableCustomerName, setEditableCustomerName] = useState("");
  const [editableCustomerAddress, setEditableCustomerAddress] = useState("");
  const [editableCustomerPhone, setEditableCustomerPhone] = useState("");
  const [editableCustomerEmail, setEditableCustomerEmail] = useState("");
  const [paymentBank, setPaymentBank] = useState("");
  const [paymentAccountName, setPaymentAccountName] = useState("");
  const [paymentAccountNumber, setPaymentAccountNumber] = useState("");
  const [preparedByName, setPreparedByName] = useState("");
  const [preparedByTitle, setPreparedByTitle] = useState("");
  
  // Estimate states
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [selectedJobForEstimate, setSelectedJobForEstimate] = useState<Job | null>(null);
  const [estimateNumber, setEstimateNumber] = useState("");
  const [estimateDate, setEstimateDate] = useState(new Date().toISOString().split('T')[0]);
  const [estimateValidUntil, setEstimateValidUntil] = useState("");
  const [estimateLineItems, setEstimateLineItems] = useState<any[]>([]);
  const [estimateNotes, setEstimateNotes] = useState("");
  const estimateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

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
    setLoading(true);
    const [jobsRes, usersRes, customersRes] = await Promise.all([
      getJobs(),
      canManage ? getAllUsers() : Promise.resolve({ ok: true, users: [] }),
      canManage ? getAllCustomers() : Promise.resolve({ ok: true, customers: [] }),
    ]);

    if (jobsRes.ok) {
      const jobsData = jobsRes.jobs as any;
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
    }

    if (usersRes.ok) {
      setUsers(usersRes.users as any);
    }

    if (customersRes.ok) {
      setCustomers(customersRes.customers as any);
    }

    setLoading(false);
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
    setEditingJob(null);
    setShowModal(true);
  };

  const openEditModal = (job: Job) => {
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
    formData.append("quantity", materialQuantity.toString());
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

  const openInvoiceModal = async (job: Job) => {
    if (!canManage) {
      setError("Only managers and admins can generate invoices");
      return;
    }

    setSelectedJobForInvoice(null);
    setShowInvoiceModal(true);
    setLoadingInvoice(true);
    setInvoiceNumber(`INV-${Date.now()}`);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    
    // Load both job data and company settings
    const [jobRes, settings] = await Promise.all([
      getJobForInvoice(job.id),
      getCompanySettingsForInvoice(),
    ]);

    // Set company settings
    setCompanySettings(settings);

    if (jobRes.ok && jobRes.job) {
      setSelectedJobForInvoice(jobRes.job);
      
      // Auto-generate line items based on pricing type
      const lineItems = [];
      
      // For Fixed Price jobs, add a single line item with the final/estimated price
      if (job.pricingType === "FIXED" && (job.finalPrice || job.estimatedPrice)) {
        lineItems.push({
          description: job.title,
          quantity: 1,
          rate: job.finalPrice || job.estimatedPrice || 0,
          amount: job.finalPrice || job.estimatedPrice || 0,
        });
      } else {
        // For T&M jobs, itemize labor and expenses
        
        // Add labor breakdown by user if available
        if (jobRes.job.laborBreakdown && jobRes.job.laborBreakdown.length > 0) {
          jobRes.job.laborBreakdown.forEach((labor: any) => {
            if (labor.hours > 0) {
              lineItems.push({
                description: `Labor - ${labor.name}`,
                quantity: Math.round(labor.hours * 100) / 100,
                rate: labor.rate,
                amount: Math.round(labor.cost * 100) / 100,
              });
            }
          });
        }
        
        // Add expenses
        if (jobRes.job.expenses && jobRes.job.expenses.length > 0) {
          jobRes.job.expenses.forEach((expense: any) => {
            lineItems.push({
              description: `${expense.category} - ${expense.description}`,
              quantity: expense.quantity || 1,
              rate: expense.amount / (expense.quantity || 1),
              amount: expense.amount,
            });
          });
        }
      }
      
      // If no line items were generated, add a placeholder
      if (lineItems.length === 0) {
        lineItems.push({
          description: job.title,
          quantity: 1,
          rate: 0,
          amount: 0,
        });
      }
      
      setInvoiceLineItems(lineItems);
      
      // Initialize editable fields
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
      
      // Initialize payment method from company settings or defaults
      // Note: bankName, accountNumber, and preparedByTitle may not exist in settings
      setPaymentBank("");
      setPaymentAccountName(settings?.companyName || "TCB Metal Works");
      setPaymentAccountNumber("");
      
      // Initialize prepared by with logged-in user
      const currentUserName = session?.user?.name || "";
      setPreparedByName(currentUserName);
      setPreparedByTitle("");
    } else {
      setError(jobRes.error);
    }
    setLoadingInvoice(false);
  };

  const addInvoiceLineItem = () => {
    setInvoiceLineItems([
      ...invoiceLineItems,
      { description: "", quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  const updateInvoiceLineItem = (index: number, field: string, value: any) => {
    const updated = [...invoiceLineItems];
    updated[index][field] = value;
    
    // Auto-calculate amount
    if (field === "quantity" || field === "rate") {
      updated[index].amount = updated[index].quantity * updated[index].rate;
    }
    
    setInvoiceLineItems(updated);
  };

  const removeInvoiceLineItem = (index: number) => {
    setInvoiceLineItems(invoiceLineItems.filter((_, i) => i !== index));
  };

  const calculateInvoiceSubtotal = () => {
    return invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const calculateInvoiceTotal = () => {
    return calculateInvoiceSubtotal() + (shippingFee || 0);
  };

  const handleDownloadPDF = () => {
    if (!selectedJobForInvoice || !companySettings) return;

    const pdfData: InvoicePDFData = {
      invoiceNumber: invoiceNumber || "123456",
      invoiceDate: invoiceDate,
      companyName: companySettings?.companyName || "TCB METAL WORKS",
      companyAddress: companySettings?.address || undefined,
      companyCity: companySettings?.city || undefined,
      companyState: companySettings?.state || undefined,
      companyZipCode: companySettings?.zipCode || undefined,
      companyPhone: companySettings?.phone || undefined,
      companyEmail: companySettings?.email || undefined,
      customerName: editableCustomerName || selectedJobForInvoice.customer?.name || "Customer",
      customerAddress: editableCustomerAddress || selectedJobForInvoice.customer?.company || undefined,
      customerPhone: editableCustomerPhone || selectedJobForInvoice.customer?.phone || undefined,
      customerEmail: editableCustomerEmail || selectedJobForInvoice.customer?.email || undefined,
      lineItems: invoiceLineItems.map(item => ({
        description: item.description || "Service",
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: item.amount || 0,
      })),
      subtotal: calculateInvoiceSubtotal(),
      shippingFee: shippingFee || 0,
      total: calculateInvoiceTotal(),
      notes: invoiceNotes || undefined,
      paymentBank: paymentBank || undefined,
      paymentAccountName: paymentAccountName || companySettings?.companyName || "TCB Metal Works",
      paymentAccountNumber: paymentAccountNumber || undefined,
      preparedByName: preparedByName || undefined,
      preparedByTitle: preparedByTitle || undefined,
    };

    const pdf = generateInvoicePDF(pdfData);
    pdf.save(`Invoice-${invoiceNumber || "INV"}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleSaveInvoice = async () => {
    if (!selectedJobForInvoice) return;

    setError(undefined);
    setSuccess(undefined);

    // Prepare line items including shipping fee as a line item if > 0
    const lines = [...invoiceLineItems];
    if (shippingFee > 0) {
      lines.push({
        description: "Shipping Fee",
        quantity: 1,
        rate: shippingFee,
        amount: shippingFee,
      });
    }

    const formData = new FormData();
    if (selectedJobForInvoice.id) formData.append("jobId", selectedJobForInvoice.id);
    if (selectedJobForInvoice.customer?.id) formData.append("customerId", selectedJobForInvoice.customer.id);
    formData.append("issueDate", invoiceDate);
    formData.append("notes", invoiceNotes || "");
    formData.append("lines", JSON.stringify(lines));
    formData.append("sentDate", new Date().toISOString().split('T')[0]);

    try {
      const res = await createInvoice(formData);
      if (!res.ok) {
        setError(res.error || "Failed to save invoice");
        return;
      }

      setSuccess("Invoice saved successfully!");
      setTimeout(() => {
        setShowInvoiceModal(false);
        setSelectedJobForInvoice(null);
        setInvoiceLineItems([]);
        setSuccess(undefined);
      }, 1500);
    } catch (err) {
      setError("An error occurred while saving the invoice");
      console.error("Error saving invoice:", err);
    }
  };

  const handlePrintInvoice = () => {
    if (!selectedJobForInvoice || !invoiceRef.current) return;
    
    // Temporarily change page title for printing
    const originalTitle = document.title;
    document.title = `Invoice ${invoiceNumber || selectedJobForInvoice?.title || ''}`;
    
    // Get the invoice content
    const invoiceContent = invoiceRef.current.querySelector('.print-area');
    if (!invoiceContent) {
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 1000);
      return;
    }
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      // Fallback to regular print if popup blocked
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 1000);
      return;
    }
    
    // Write the invoice content to new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoiceNumber || selectedJobForInvoice?.title || ''}</title>
          <style>
            @page {
              margin: 0.5in;
              size: letter;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              background: white;
            }
            .print-area {
              padding: 0.5in;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            input, textarea {
              border: none;
              background: transparent;
              width: 100%;
            }
            .print-no-border {
              border: none !important;
            }
          </style>
        </head>
        <body>
          ${invoiceContent.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Close window after printing (optional)
      setTimeout(() => {
        printWindow.close();
        document.title = originalTitle;
      }, 500);
    }, 250);
  };

  // Estimate Functions
  const openEstimateModal = async (job: Job) => {
    if (!canManage) {
      setError("Only managers and admins can generate estimates");
      return;
    }

    setSelectedJobForEstimate(job);
    setShowEstimateModal(true);
    setEstimateNumber(`EST-${Date.now()}`);
    setEstimateDate(new Date().toISOString().split('T')[0]);
    
    // Set valid until date to 30 days from now
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    setEstimateValidUntil(validUntil.toISOString().split('T')[0]);
    
    // Load company settings if not already loaded
    if (!companySettings) {
      const settings = await getCompanySettingsForInvoice();
      setCompanySettings(settings);
    }
    
    // Auto-generate estimate line items based on job pricing
    const lineItems = [];
    
    if (job.estimatedPrice && job.estimatedPrice > 0) {
      // If there's an estimated price, use it
      lineItems.push({
        description: job.title,
        quantity: 1,
        rate: job.estimatedPrice,
        amount: job.estimatedPrice,
      });
    } else {
      // Otherwise add a placeholder
      lineItems.push({
        description: job.title,
        quantity: 1,
        rate: 0,
        amount: 0,
      });
    }
    
    setEstimateLineItems(lineItems);
    setEstimateNotes("This estimate is valid for 30 days from the date above. Final pricing may vary based on actual work performed.");
  };

  const addEstimateLineItem = () => {
    setEstimateLineItems([
      ...estimateLineItems,
      { description: "", quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  const updateEstimateLineItem = (index: number, field: string, value: any) => {
    const updated = [...estimateLineItems];
    updated[index][field] = value;
    
    // Auto-calculate amount
    if (field === "quantity" || field === "rate") {
      updated[index].amount = updated[index].quantity * updated[index].rate;
    }
    
    setEstimateLineItems(updated);
  };

  const removeEstimateLineItem = (index: number) => {
    setEstimateLineItems(estimateLineItems.filter((_, i) => i !== index));
  };

  const calculateEstimateTotal = () => {
    return estimateLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const handlePrintEstimate = () => {
    if (!selectedJobForEstimate || !estimateRef.current) return;
    
    // Temporarily change page title for printing
    const originalTitle = document.title;
    document.title = `Estimate ${selectedJobForEstimate?.title || ''}`;
    
    // Get the estimate content
    const estimateContent = estimateRef.current.querySelector('.print-area');
    if (!estimateContent) {
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 1000);
      return;
    }
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      // Fallback to regular print if popup blocked
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 1000);
      return;
    }
    
    // Write the estimate content to new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Estimate ${selectedJobForEstimate?.title || ''}</title>
          <style>
            @page {
              margin: 0.5in;
              size: letter;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              background: white;
            }
            .print-area {
              padding: 0.5in;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            input, textarea {
              border: none;
              background: transparent;
              width: 100%;
            }
            .print-no-border {
              border: none !important;
            }
          </style>
        </head>
        <body>
          ${estimateContent.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Close window after printing (optional)
      setTimeout(() => {
        printWindow.close();
        document.title = originalTitle;
      }, 500);
    }, 250);
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

  const filteredJobs = jobs.filter((job) => {
    if (filterStatus !== "ALL" && job.status !== filterStatus) return false;
    if (filterPriority !== "ALL" && job.priority !== filterPriority) return false;
    return true;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No due date";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Management</h1>
            <p className="text-sm text-gray-500">View and manage all jobs</p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ALL">All Status</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="AWAITING_QC">Submit to QC</option>
              <option value="REWORK">Rework</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ALL">All Priority</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {canManage && (
            <button
              onClick={openCreateModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + Create Job
            </button>
          )}
        </div>

        {/* Jobs Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading jobs...</div>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-600 mb-6">
              {jobs.length === 0
                ? canManage
                  ? "Create your first job to get started"
                  : "No jobs assigned to you yet"
                : "Try adjusting your filters"}
            </p>
            {canManage && jobs.length === 0 && (
              <button
                onClick={openCreateModal}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create First Job
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{job.title}</h3>
                    <div className="flex gap-2 flex-wrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status.replace("_", " ")}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(job.priority)}`}>
                        {job.priority}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {job.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{job.description}</p>
                )}

                {/* Details */}
                <div className="space-y-2 text-sm border-t pt-4">
                  {canManage && job.customer && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-blue-700 uppercase">Customer</span>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-gray-900">{job.customer.name}</p>
                        {job.customer.company && (
                          <p className="text-xs text-gray-600">🏢 {job.customer.company}</p>
                        )}
                        {job.customer.phone && (
                          <p className="text-xs text-gray-600">📞 {job.customer.phone}</p>
                        )}
                        {job.customer.email && (
                          <p className="text-xs text-gray-600">📧 {job.customer.email}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Pricing Info */}
                  {canManage && (job.estimatedPrice || job.finalPrice) && (
                    <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-green-700 uppercase">
                          💰 {job.pricingType === "T&M" ? "Time & Materials" : "Fixed Price"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {job.estimatedPrice && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Estimated:</span>
                            <span className="font-medium text-gray-900">${job.estimatedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {job.finalPrice && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Final Price:</span>
                            <span className="font-bold text-green-700">${job.finalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-gray-500">Assigned to:</span>
                    <span className="font-medium text-gray-900">
                      {job.assignee ? job.assignee.name : "Unassigned"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Due date:</span>
                    <span className="font-medium text-gray-900">{formatDate(job.dueDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Started:</span>
                    <span className="font-medium text-gray-900">{formatDate(job.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created by:</span>
                    <span className="font-medium text-gray-900">{job.creator.name}</span>
                  </div>
                </div>

                {/* Photo Upload Section */}
                {job.status !== "COMPLETED" && job.status !== "CANCELLED" && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">📷 Job Photos</h4>
                    
                    {/* Locked message when submitted to QC */}
                    {job.status === "AWAITING_QC" && (
                      <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-xs text-purple-800 font-medium">
                          🔒 This job has been submitted to QC. Editing is locked until returned for rework.
                        </p>
                      </div>
                    )}

                    {/* Existing Photos */}
                    {(jobExistingPhotos[job.id] || []).length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-600 mb-2">
                          Saved Photos: {(jobExistingPhotos[job.id] || []).length}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {(jobExistingPhotos[job.id] || []).map((photo) => (
                            <div
                              key={photo.id}
                              className="relative bg-gray-100 border border-gray-200 rounded p-2 flex items-center gap-2"
                            >
                              <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden">
                                <img
                                  src={photo.url}
                                  alt="Saved photo"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <p className="text-xs flex-1 truncate">Saved</p>
                              {job.status !== "AWAITING_QC" && job.status !== "COMPLETED" && (
                                <button
                                  onClick={() => handleRemovePhoto(job.id, photo.id, photo.url, photo.activityId)}
                                  disabled={removingPhotos[photo.id]}
                                  type="button"
                                  className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                                >
                                  {removingPhotos[photo.id] ? "..." : "✕"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Photo Upload (only if not locked) */}
                    {job.status !== "AWAITING_QC" && job.status !== "COMPLETED" && (
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleJobPhotoSelect(job.id, e)}
                          className="hidden"
                          id={`photo-upload-${job.id}`}
                          disabled={job.status === "AWAITING_QC" || job.status === "COMPLETED"}
                        />
                        <label
                          htmlFor={`photo-upload-${job.id}`}
                          className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <span>📷</span>
                          Choose Photos
                        </label>

                        {(jobPhotoFiles[job.id] || []).length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-gray-600">
                              New Photos Selected: {(jobPhotoFiles[job.id] || []).length} photo(s)
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {(jobPhotoFiles[job.id] || []).map((file, index) => (
                                <div
                                  key={index}
                                  className="relative bg-gray-100 border border-gray-200 rounded p-2 flex items-center gap-2"
                                >
                                  <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden">
                                    <img
                                      src={URL.createObjectURL(file)}
                                      alt={`Preview ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <p className="text-xs flex-1 truncate">{file.name}</p>
                                  <button
                                    onClick={() => removeJobPhoto(job.id, index)}
                                    type="button"
                                    className="text-red-500 hover:text-red-700 text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 mt-3">
                          {(jobPhotoFiles[job.id] || []).length > 0 && (
                            <button
                              onClick={() => handleSavePhotos(job.id)}
                              disabled={savingPhotos[job.id]}
                              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              {savingPhotos[job.id] ? "Saving..." : "Save"}
                            </button>
                          )}
                          <button
                            onClick={() => handleSubmitToQC(job.id)}
                            disabled={savingPhotos[job.id]}
                            className={`px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed ${
                              (jobPhotoFiles[job.id] || []).length > 0 ? "flex-1" : "w-full"
                            }`}
                          >
                            {savingPhotos[job.id] ? "Submitting..." : "Submit to QC"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                       {/* Actions */}
                       <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                         <button
                           onClick={() => openActivityModal(job)}
                           disabled={job.status === "AWAITING_QC" || job.status === "COMPLETED"}
                           className="px-3 py-2 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                           title={job.status === "AWAITING_QC" || job.status === "COMPLETED" ? "Job is locked - submitted to QC" : "View notes, photos, and updates for this job"}
                         >
                           📝 Activity
                         </button>
                         <button
                           onClick={() => openMaterialModal(job)}
                           disabled={job.status === "AWAITING_QC" || job.status === "COMPLETED"}
                           className="px-3 py-2 text-sm border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                           title={job.status === "AWAITING_QC" || job.status === "COMPLETED" ? "Job is locked - submitted to QC" : "View and request materials for this job"}
                         >
                           📦 Materials
                         </button>
                         {canManage && (
                          <>
                            <button
                              onClick={() => openEstimateModal(job)}
                              className="px-3 py-2 text-sm border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors font-medium"
                              title="Generate estimate/quote for this job"
                            >
                              💰 Estimate
                            </button>
                            <button
                              onClick={() => openInvoiceModal(job)}
                              className="px-3 py-2 text-sm border border-blue-900 text-blue-900 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                              title="Generate invoice for this job"
                            >
                              📄 Invoice
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openEditModal(job)}
                          disabled={job.status === "AWAITING_QC" || job.status === "COMPLETED"}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                          title={job.status === "AWAITING_QC" || job.status === "COMPLETED" ? "Job is locked - submitted to QC" : "Edit job"}
                        >
                          Edit
                        </button>
                         {canManage && (
                           <button
                             onClick={() => handleDelete(job.id)}
                             className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                           >
                             Delete
                           </button>
                         )}
                       </div>
              </div>
            ))}
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
                return (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title *
                      </label>
                      <input
                        name="title"
                        type="text"
                        defaultValue={editingJob?.title}
                        required
                        disabled={isLocked}
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
                      disabled={isLocked}
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
                      disabled={isLocked}
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
                      disabled={isLocked}
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
                        disabled={isLocked}
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
                          disabled={isLocked}
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
                          disabled={isLocked}
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
                            disabled={isLocked}
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
                            disabled={isLocked}
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
                            disabled={isLocked}
                            className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                          <select
                            name="estimatedDurationUnit"
                            value={estimatedDurationUnit}
                            onChange={(e) =>
                              setEstimatedDurationUnit(e.target.value as any)
                            }
                            disabled={isLocked}
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
                    disabled={isLocked}
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
                    disabled={isLocked}
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
                                {new Date(activity.createdAt).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
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
                              {images.map((imgPath: string, idx: number) => (
                                <a
                                  key={idx}
                                  href={imgPath}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-300 hover:border-blue-500 transition-all"
                                >
                                  <img
                                    src={imgPath}
                                    alt={`Photo ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 text-white text-xl">🔍</span>
                                  </div>
                                </a>
                              ))}
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
                        onChange={(e) => setMaterialQuantity(Number(e.target.value))}
                        min="1"
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
                              Requested by {request.user.name || request.user.email} • {new Date(request.requestedDate).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
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

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 no-print print-area-container">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            {loadingInvoice ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading invoice data...</p>
              </div>
            ) : selectedJobForInvoice ? (
              <div ref={invoiceRef}>
                {/* Invoice Header - Print & Edit Section */}
                <div className="p-6 border-b bg-gray-50 no-print">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Generate Invoice</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveInvoice}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        💾 Save Invoice
                      </button>
                      <button
                        onClick={handleDownloadPDF}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        📥 Download PDF
                      </button>
                      <button
                        onClick={() => {
                          setShowInvoiceModal(false);
                          setSelectedJobForInvoice(null);
                          setInvoiceLineItems([]);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>

                {/* Invoice Content - Printable */}
                <div className="p-8 print-area bg-white">
                  {/* Header Section - Invoice Title, Number, Date, and Logo Area */}
                  <div className="flex justify-between items-start mb-8">
                    {/* Left: Invoice Title and Details */}
                    <div className="flex-1">
                      <h1 className="text-5xl font-bold text-gray-900 mb-4">INVOICE</h1>
                      <div className="space-y-1 text-gray-700">
                        <div>
                          <span className="font-medium">Invoice Number: </span>
                          <span className="font-semibold">#</span>
                          <input
                            type="text"
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            className="font-semibold border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent w-32"
                            placeholder="123456"
                          />
                        </div>
                        <div>
                          <span className="font-medium">Invoice Date: </span>
                          <input
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className="font-semibold border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent"
                          />
                          <span className="font-semibold print-only ml-2">
                            {invoiceDate ? new Date(invoiceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Top Right: Logo Text - TCB above METAL WORKS, centered as a unit, positioned on the right */}
                    <div className="flex justify-end">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-900 mb-1">
                          TCB
                        </div>
                        <div className="text-lg font-bold text-blue-900">
                          METAL WORKS
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Company and Billing Information */}
                  <div className="grid grid-cols-2 gap-12 mb-8">
                    {/* Left: Company Info */}
                    <div>
                      <p className="font-bold text-gray-900 text-lg mb-2">
                        {companySettings?.companyName || "TCB METAL WORKS"}
                      </p>
                      <div className="text-gray-700 text-sm space-y-1">
                        {companySettings?.address && <p>{companySettings.address}</p>}
                        {(companySettings?.city || companySettings?.state || companySettings?.zipCode) && (
                          <p>
                            {companySettings.city}{companySettings.city && companySettings.state ? ", " : ""}{companySettings.state} {companySettings.zipCode}
                          </p>
                        )}
                        {companySettings?.phone && <p>{companySettings.phone}</p>}
                        {companySettings?.email && <p>{companySettings.email}</p>}
                      </div>
                    </div>

                    {/* Right: Bill To - Editable */}
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2">BILL TO</h3>
                      <div className="text-gray-700 text-sm space-y-1">
                        <input
                          type="text"
                          value={editableCustomerName}
                          onChange={(e) => setEditableCustomerName(e.target.value)}
                          className="font-semibold w-full border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent mb-1"
                          placeholder="Customer Name"
                        />
                        <input
                          type="text"
                          value={editableCustomerAddress}
                          onChange={(e) => setEditableCustomerAddress(e.target.value)}
                          className="w-full border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent mb-1"
                          placeholder="Address"
                        />
                        <input
                          type="text"
                          value={editableCustomerPhone}
                          onChange={(e) => setEditableCustomerPhone(e.target.value)}
                          className="w-full border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent mb-1"
                          placeholder="Phone"
                        />
                        <input
                          type="email"
                          value={editableCustomerEmail}
                          onChange={(e) => setEditableCustomerEmail(e.target.value)}
                          className="w-full border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent"
                          placeholder="Email"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="mb-8">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-200">
                          <th className="border border-gray-400 px-4 py-3 text-left text-sm font-semibold text-gray-900">Item & Description</th>
                          <th className="border border-gray-400 px-4 py-3 text-right text-sm font-semibold text-gray-900">Unit Price</th>
                          <th className="border border-gray-400 px-4 py-3 text-center text-sm font-semibold text-gray-900">Qty</th>
                          <th className="border border-gray-400 px-4 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                          <th className="border border-gray-400 px-4 py-3 text-center w-20 no-print">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceLineItems.map((item, index) => (
                          <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="border border-gray-300 px-4 py-3">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateInvoiceLineItem(index, "description", e.target.value)}
                                className="w-full outline-none print-no-border bg-transparent"
                                placeholder="Service description"
                              />
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-right">
                              <input
                                type="number"
                                value={item.rate}
                                onChange={(e) => updateInvoiceLineItem(index, "rate", parseFloat(e.target.value) || 0)}
                                className="w-full text-right outline-none print-no-border bg-transparent"
                                step="0.01"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateInvoiceLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                className="w-full text-center outline-none print-no-border bg-transparent"
                                step="0.01"
                                placeholder="1"
                              />
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-right font-semibold">
                              ${item.amount.toFixed(2)}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center no-print">
                              <button
                                onClick={() => removeInvoiceLineItem(index)}
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
                      onClick={addInvoiceLineItem}
                      className="mt-3 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-900 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-600 w-full no-print"
                    >
                      + Add Line Item
                    </button>
                  </div>

                  {/* Notes and Summary Section */}
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Left: Notes/Terms */}
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2">NOTES / TERMS:</h3>
                      <textarea
                        value={invoiceNotes || "Payment is due within 15 days of receiving this invoice."}
                        onChange={(e) => setInvoiceNotes(e.target.value)}
                        placeholder="Payment terms, work scope, warranty information..."
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:border-blue-900 print-no-border bg-white"
                      />
                    </div>

                    {/* Right: Summary Table */}
                    <div>
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 px-4 py-2 text-left font-semibold bg-gray-100">Sub-Total</td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-semibold bg-gray-100">
                              ${calculateInvoiceSubtotal().toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 px-4 py-2 text-left">
                              <div className="flex items-center gap-2">
                                <span>Shipping Fee</span>
                                <input
                                  type="number"
                                  value={shippingFee}
                                  onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                                  className="w-24 border border-gray-300 rounded px-2 py-1 text-sm no-print"
                                  step="0.01"
                                  placeholder="0.00"
                                />
                              </div>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              ${(shippingFee || 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr className="bg-gray-200">
                            <td className="border border-gray-400 px-4 py-3 text-left font-bold text-gray-900">Total</td>
                            <td className="border border-gray-400 px-4 py-3 text-right font-bold text-gray-900">
                              ${calculateInvoiceTotal().toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Footer - Payment Method and Prepared By */}
                  <div className="grid grid-cols-2 gap-12 mb-4">
                    {/* Left: Payment Method - Editable */}
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2">PAYMENT METHOD</h3>
                      <div className="text-gray-700 text-sm space-y-1">
                        <div>
                          <span className="font-semibold">Bank: </span>
                          <input
                            type="text"
                            value={paymentBank}
                            onChange={(e) => setPaymentBank(e.target.value)}
                            className="border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent w-48"
                            placeholder="Bank Name"
                          />
                        </div>
                        <div>
                          <span className="font-semibold">Account Name: </span>
                          <input
                            type="text"
                            value={paymentAccountName}
                            onChange={(e) => setPaymentAccountName(e.target.value)}
                            className="border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent w-48"
                            placeholder="Account Name"
                          />
                        </div>
                        <div>
                          <span className="font-semibold">Account Number: </span>
                          <input
                            type="text"
                            value={paymentAccountNumber}
                            onChange={(e) => setPaymentAccountNumber(e.target.value)}
                            className="border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent w-48"
                            placeholder="Account Number"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right: Prepared By - Editable */}
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2">PREPARED BY</h3>
                      <div className="text-gray-700 text-sm space-y-1">
                        <input
                          type="text"
                          value={preparedByName}
                          onChange={(e) => setPreparedByName(e.target.value)}
                          className="w-full border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent mb-1"
                          placeholder="Name"
                        />
                        <input
                          type="text"
                          value={preparedByTitle}
                          onChange={(e) => setPreparedByTitle(e.target.value)}
                          className="w-full border-b border-gray-300 focus:border-blue-900 outline-none print-no-border bg-transparent"
                          placeholder="Title"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Navy Blue Border at Bottom */}
                  <div className="border-b-4 border-blue-900 mt-6"></div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-600">Failed to load job data</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estimate Modal */}
      {showEstimateModal && selectedJobForEstimate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 no-print print-area-container">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            <div ref={estimateRef}>
              {/* Estimate Header */}
              <div className="p-6 border-b bg-gray-50 no-print">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Generate Estimate</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrintEstimate}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                    >
                      🖨️ Print Estimate
                    </button>
                    <button
                      onClick={() => {
                        setShowEstimateModal(false);
                        setSelectedJobForEstimate(null);
                        setEstimateLineItems([]);
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
                    {selectedJobForEstimate.customer ? (
                      <div className="text-gray-900">
                        <p className="font-semibold">{selectedJobForEstimate.customer.name}</p>
                        {selectedJobForEstimate.customer.company && (
                          <p>{selectedJobForEstimate.customer.company}</p>
                        )}
                        {selectedJobForEstimate.customer.phone && (
                          <p>{selectedJobForEstimate.customer.phone}</p>
                        )}
                        {selectedJobForEstimate.customer.email && (
                          <p>{selectedJobForEstimate.customer.email}</p>
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
                        <span className="text-gray-600 text-right">Estimate #:</span>
                        <input
                          type="text"
                          value={estimateNumber}
                          onChange={(e) => setEstimateNumber(e.target.value)}
                          className="font-semibold text-right border-b border-gray-300 focus:border-orange-500 outline-none print-no-border"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <span className="text-gray-600 text-right">Date:</span>
                        <input
                          type="date"
                          value={estimateDate}
                          onChange={(e) => setEstimateDate(e.target.value)}
                          className="font-semibold text-right border-b border-gray-300 focus:border-orange-500 outline-none print-no-border"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <span className="text-gray-600 text-right">Valid Until:</span>
                        <input
                          type="date"
                          value={estimateValidUntil}
                          onChange={(e) => setEstimateValidUntil(e.target.value)}
                          className="font-semibold text-right border-b border-gray-300 focus:border-orange-500 outline-none print-no-border"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <span className="text-gray-600 text-right">Job:</span>
                        <span className="font-semibold text-right">{selectedJobForEstimate.title}</span>
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
                      {estimateLineItems.map((item, index) => (
                        <tr key={index}>
                          <td className="border border-gray-300 px-4 py-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateEstimateLineItem(index, "description", e.target.value)}
                              className="w-full outline-none print-no-border"
                              placeholder="Description"
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateEstimateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                              className="w-full text-center outline-none print-no-border"
                              step="0.01"
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right">
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => updateEstimateLineItem(index, "rate", parseFloat(e.target.value) || 0)}
                              className="w-full text-right outline-none print-no-border"
                              step="0.01"
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                            ${item.amount.toFixed(2)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center no-print">
                            <button
                              onClick={() => removeEstimateLineItem(index)}
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
                    onClick={addEstimateLineItem}
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
                      <span>${calculateEstimateTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-3 border-t-2 border-gray-800">
                      <span className="text-lg font-bold">Total Estimate:</span>
                      <span className="text-lg font-bold">${calculateEstimateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Terms & Notes */}
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Terms & Conditions:</h3>
                  <textarea
                    value={estimateNotes}
                    onChange={(e) => setEstimateNotes(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none print-no-border"
                    placeholder="Add any terms, conditions, or notes..."
                  />
                </div>

                {/* Contract Agreement & Signatures */}
                <div className="mb-8 border-t-2 border-gray-800 pt-8">
                  <h3 className="text-md font-bold text-gray-900 mb-4">ESTIMATE APPROVAL & AUTHORIZATION</h3>
                  <p className="text-sm text-gray-700 mb-6 leading-relaxed">
                    By signing below, the customer approves this estimate and authorizes the work to proceed as described. 
                    The customer understands that this is an estimate and final costs may vary based on actual work performed. 
                    Any significant changes will be communicated before proceeding.
                  </p>

                  <div className="grid grid-cols-2 gap-8 mt-8">
                    {/* Customer Signature */}
                    <div>
                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">
                          Customer Signature
                        </label>
                        <div className="border-b-2 border-gray-800 pb-1 h-16 flex items-end">
                          <span className="text-gray-400 text-sm italic">Signature</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                            Print Name
                          </label>
                          <div className="border-b border-gray-400 pb-1">
                            {selectedJobForEstimate?.customer?.name || "________________"}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                            Date
                          </label>
                          <div className="border-b border-gray-400 pb-1">
                            ________________
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Company Representative Signature */}
                    <div>
                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">
                          Company Representative
                        </label>
                        <div className="border-b-2 border-gray-800 pb-1 h-16 flex items-end">
                          <span className="text-gray-400 text-sm italic">Signature</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                            Print Name
                          </label>
                          <div className="border-b border-gray-400 pb-1">
                            ________________
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                            Date
                          </label>
                          <div className="border-b border-gray-400 pb-1">
                            ________________
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center text-gray-500 text-sm border-t pt-6">
                  <p className="font-semibold">This document serves as both an estimate and work authorization agreement.</p>
                  <p className="mt-2">Thank you for your business!</p>
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
    </main>
  );
}

