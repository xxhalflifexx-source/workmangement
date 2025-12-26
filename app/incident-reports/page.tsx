"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getIncidentReports,
  createIncidentReport,
  updateIncidentReport,
  deleteIncidentReport,
  getJobsForIncident,
  getEmployeesForIncident,
  IncidentReportWithRelations,
  IncidentStatus,
  IncidentSeverity,
  EmployeeRole,
} from "./actions";
import MobileCardView from "@/components/MobileCardView";
import MobileModal from "@/components/MobileModal";

// Status badge colors
const statusColors: Record<string, string> = {
  OPEN: "bg-red-100 text-red-800 border-red-200",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-800 border-yellow-200",
  RESOLVED: "bg-blue-100 text-blue-800 border-blue-200",
  CLOSED: "bg-gray-100 text-gray-800 border-gray-200",
};

// Severity badge colors
const severityColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
};

// Employee role colors
const roleColors: Record<string, string> = {
  INVOLVED: "bg-blue-100 text-blue-800",
  WITNESS: "bg-purple-100 text-purple-800",
  INJURED: "bg-red-100 text-red-800",
};

export default function IncidentReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<IncidentReportWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<IncidentReportWithRelations | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "">("");
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | "">("");
  
  // Form state
  const [jobs, setJobs] = useState<{ id: string; jobNumber: string | null; title: string; status: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string | null; email: string | null; role: string }[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    incidentDate: new Date().toISOString().split("T")[0],
    location: "",
    injuryDetails: "",
    severity: "LOW" as IncidentSeverity,
    status: "OPEN" as IncidentStatus,
    jobId: "",
    employeesInvolved: [] as { userId: string; role: EmployeeRole }[],
    photos: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data function
  const loadData = useCallback(async (filters?: { status?: string; severity?: string }) => {
    console.log("[IncidentReports] Loading data...");
    setLoading(true);
    setError(null);
    
    try {
      const [reportsRes, jobsRes, employeesRes] = await Promise.all([
        getIncidentReports({
          status: (filters?.status || statusFilter || undefined) as IncidentStatus | undefined,
          severity: (filters?.severity || severityFilter || undefined) as IncidentSeverity | undefined,
        }),
        getJobsForIncident(),
        getEmployeesForIncident(),
      ]);

      console.log("[IncidentReports] Reports response:", reportsRes);
      console.log("[IncidentReports] Jobs response:", jobsRes);
      console.log("[IncidentReports] Employees response:", employeesRes);

      if (reportsRes.ok && reportsRes.reports) {
        setReports(reportsRes.reports as IncidentReportWithRelations[]);
      } else {
        console.error("[IncidentReports] Failed to load reports:", reportsRes.error);
        setError(reportsRes.error || "Failed to load reports");
      }

      if (jobsRes.ok && jobsRes.jobs) {
        setJobs(jobsRes.jobs);
      } else {
        console.error("[IncidentReports] Failed to load jobs:", jobsRes.error);
      }

      if (employeesRes.ok && employeesRes.employees) {
        setEmployees(employeesRes.employees);
        console.log("[IncidentReports] Loaded employees:", employeesRes.employees.length);
      } else {
        console.error("[IncidentReports] Failed to load employees:", employeesRes.error);
      }
    } catch (err) {
      console.error("[IncidentReports] Error loading data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  // Check authentication and role - only run once
  useEffect(() => {
    if (status === "loading") return;
    if (initialized) return;
    
    if (!session?.user) {
      router.push("/login");
      return;
    }
    
    const role = (session.user as any).role;
    if (role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    
    setInitialized(true);
    loadData();
  }, [session, status, router, initialized, loadData]);

  // Handle filter changes
  const handleFilterChange = (type: "status" | "severity", value: string) => {
    if (type === "status") {
      setStatusFilter(value as IncidentStatus | "");
    } else {
      setSeverityFilter(value as IncidentSeverity | "");
    }
  };

  // Apply filters button
  const applyFilters = () => {
    loadData({ status: statusFilter, severity: severityFilter });
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      incidentDate: new Date().toISOString().split("T")[0],
      location: "",
      injuryDetails: "",
      severity: "LOW",
      status: "OPEN",
      jobId: "",
      employeesInvolved: [],
      photos: [],
    });
  };

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formDataUpload = new FormData();
      for (let i = 0; i < files.length; i++) {
        formDataUpload.append("files", files[i]);
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });

      const result = await response.json();

      if (result.success && result.paths) {
        setFormData((prev) => ({
          ...prev,
          photos: [...prev.photos, ...result.paths],
        }));
      } else {
        setError(result.error || "Failed to upload photos");
      }
    } catch (err) {
      console.error("[IncidentReports] Upload error:", err);
      setError("Failed to upload photos");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remove photo
  const removePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      console.log("[IncidentReports] Creating report with data:", formData);
      
      const res = await createIncidentReport({
        title: formData.title,
        description: formData.description,
        incidentDate: new Date(formData.incidentDate),
        location: formData.location,
        injuryDetails: formData.injuryDetails || undefined,
        severity: formData.severity,
        jobId: formData.jobId || undefined,
        employeesInvolved: formData.employeesInvolved.filter(e => e.userId).length > 0 
          ? formData.employeesInvolved.filter(e => e.userId) 
          : undefined,
        photos: formData.photos.length > 0 ? formData.photos : undefined,
      });

      console.log("[IncidentReports] Create response:", res);

      if (res.ok) {
        setShowCreateModal(false);
        resetForm();
        loadData();
      } else {
        setError(res.error || "Failed to create incident report");
      }
    } catch (err) {
      console.error("[IncidentReports] Create error:", err);
      setError("Failed to create incident report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const res = await updateIncidentReport(selectedReport.id, {
        title: formData.title,
        description: formData.description,
        incidentDate: new Date(formData.incidentDate),
        location: formData.location,
        injuryDetails: formData.injuryDetails || undefined,
        status: formData.status,
        severity: formData.severity,
        jobId: formData.jobId || null,
        employeesInvolved: formData.employeesInvolved.filter(e => e.userId),
        photos: formData.photos,
      });

      if (res.ok) {
        setShowDetailModal(false);
        setIsEditing(false);
        setSelectedReport(null);
        resetForm();
        loadData();
      } else {
        setError(res.error || "Failed to update incident report");
      }
    } catch (err) {
      console.error("[IncidentReports] Update error:", err);
      setError("Failed to update incident report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this incident report?")) return;
    
    try {
      const res = await deleteIncidentReport(id);
      if (res.ok) {
        setShowDetailModal(false);
        setSelectedReport(null);
        loadData();
      } else {
        setError(res.error || "Failed to delete incident report");
      }
    } catch (err) {
      setError("Failed to delete incident report");
    }
  };

  const openDetail = (report: IncidentReportWithRelations) => {
    setSelectedReport(report);
    setFormData({
      title: report.title,
      description: report.description,
      incidentDate: new Date(report.incidentDate).toISOString().split("T")[0],
      location: report.location,
      injuryDetails: report.injuryDetails || "",
      severity: report.severity as IncidentSeverity,
      status: report.status as IncidentStatus,
      jobId: report.jobId || "",
      employeesInvolved: report.employeesInvolved.map((e) => ({
        userId: e.userId,
        role: e.role as EmployeeRole,
      })),
      photos: report.photos || [],
    });
    setShowDetailModal(true);
  };

  const addEmployee = () => {
    setFormData((prev) => ({
      ...prev,
      employeesInvolved: [...prev.employeesInvolved, { userId: "", role: "INVOLVED" as EmployeeRole }],
    }));
  };

  const removeEmployee = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      employeesInvolved: prev.employeesInvolved.filter((_, i) => i !== index),
    }));
  };

  const updateEmployee = (index: number, field: "userId" | "role", value: string) => {
    setFormData((prev) => ({
      ...prev,
      employeesInvolved: prev.employeesInvolved.map((emp, i) =>
        i === index ? { ...emp, [field]: value } : emp
      ),
    }));
  };

  // Photo upload section component
  const PhotoUploadSection = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>
      
      {/* Photo previews */}
      {formData.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {formData.photos.map((photo, index) => (
            <div key={index} className="relative group">
              <img
                src={photo}
                alt={`Incident photo ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Upload buttons */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoUpload}
          className="hidden"
          id="photo-upload"
        />
        <label
          htmlFor="photo-upload"
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors ${
            uploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {uploading ? (
            <>
              <span className="animate-spin">⏳</span>
              <span className="text-sm text-gray-600">Uploading...</span>
            </>
          ) : (
            <>
              <span>📷</span>
              <span className="text-sm text-gray-600">Add Photos</span>
            </>
          )}
        </label>
        <label
          htmlFor="photo-upload"
          className={`flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors ${
            uploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.setAttribute("capture", "environment");
            }
          }}
        >
          <span>📸</span>
          <span className="text-sm">Capture</span>
        </label>
      </div>
    </div>
  );

  if (status === "loading" || (loading && !initialized)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black border-b-2 border-[#001f3f] shadow-lg sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <Link href="/dashboard" className="text-white hover:text-gray-300 transition-colors text-base sm:text-sm min-h-[44px] flex items-center">
              ← Back
            </Link>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">⚠️ Incident Reports</h1>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 min-h-[44px] text-base sm:text-sm"
          >
            <span>+</span> New Report
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg shadow p-4 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap gap-4 items-stretch sm:items-end">
          <div className="flex-1 sm:flex-initial">
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base sm:text-sm min-h-[44px]"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div className="flex-1 sm:flex-initial">
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => handleFilterChange("severity", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base sm:text-sm min-h-[44px]"
            >
              <option value="">All Severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <button
            onClick={applyFilters}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-base sm:text-sm font-medium transition-colors min-h-[44px] w-full sm:w-auto"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="w-full px-4 sm:px-6 lg:px-8 mb-4">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-900 font-bold hover:bg-red-100 rounded px-2">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && initialized && (
        <div className="w-full px-4 sm:px-6 lg:px-8 mb-4">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
            Loading...
          </div>
        </div>
      )}

      {/* Reports List */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {reports.length === 0 && !loading ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg">No incident reports found</p>
              <p className="text-sm mt-2">Create a new report to get started</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                      Title
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employees
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Photos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      onClick={() => openDetail(report)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-5">
                        <div className="font-medium text-gray-900 text-base">{report.title}</div>
                        <div className="text-sm text-gray-500 mt-1 line-clamp-2">{report.description}</div>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-600 whitespace-nowrap">
                        {new Date(report.incidentDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-600">{report.location}</td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                            statusColors[report.status] || statusColors.OPEN
                          }`}
                        >
                          {report.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                            severityColors[report.severity] || severityColors.LOW
                          }`}
                        >
                          {report.severity}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-600 whitespace-nowrap">
                        {report.job ? (report.job.jobNumber || `#${report.job.id.slice(0, 8).toUpperCase()}`) : "-"}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-600">
                        {report.employeesInvolved.length > 0
                          ? report.employeesInvolved.length + " person(s)"
                          : "-"}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-600">
                        {report.photos?.length > 0 ? `📷 ${report.photos.length}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Mobile Card View */}
              <MobileCardView
                items={reports}
                emptyMessage="No incident reports found"
                className="md:hidden p-4"
                renderCard={(report) => (
                  <div
                    onClick={() => openDetail(report)}
                    className="bg-white border-2 border-gray-200 rounded-xl p-4 mb-4 shadow-sm hover:shadow-md active:shadow-lg transition-all touch-manipulation"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-900 mb-1">{report.title}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2">{report.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${
                          statusColors[report.status] || statusColors.OPEN
                        }`}
                      >
                        {report.status.replace("_", " ")}
                      </span>
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${
                          severityColors[report.severity] || severityColors.LOW
                        }`}
                      >
                        {report.severity}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Date:</span>
                        <span className="ml-2 text-gray-900 font-medium">
                          {new Date(report.incidentDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Location:</span>
                        <span className="ml-2 text-gray-900 font-medium">{report.location}</span>
                      </div>
                      {report.job && (
                        <div>
                          <span className="text-gray-500">Job:</span>
                          <span className="ml-2 text-gray-900 font-medium">
                            {report.job.jobNumber || `#${report.job.id.slice(0, 8).toUpperCase()}`}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Employees:</span>
                        <span className="ml-2 text-gray-900 font-medium">
                          {report.employeesInvolved.length > 0
                            ? report.employeesInvolved.length + " person(s)"
                            : "-"}
                        </span>
                      </div>
                      {report.photos?.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Photos:</span>
                          <span className="ml-2 text-gray-900 font-medium">📷 {report.photos.length}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              />
            </>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <MobileModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Incident Report"
      >
        <form onSubmit={handleCreate} className="space-y-5">
              {/* Error in modal */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                  placeholder="Brief description of incident"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.incidentDate}
                    onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                    placeholder="Where did it occur?"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity *</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as IncidentSeverity })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                  placeholder="Detailed description of what happened..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Injury Details</label>
                <textarea
                  rows={2}
                  value={formData.injuryDetails}
                  onChange={(e) => setFormData({ ...formData, injuryDetails: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                  placeholder="Any injuries sustained..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Related Job</label>
                <select
                  value={formData.jobId}
                  onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                >
                  <option value="">No related job</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.jobNumber || `#${job.id.slice(0, 8).toUpperCase()}`} - {job.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Employees Involved */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Employees Involved ({employees.length} available)
                  </label>
                  <button
                    type="button"
                    onClick={addEmployee}
                    className="text-base sm:text-sm text-blue-600 hover:text-blue-800 font-medium min-h-[44px] flex items-center"
                  >
                    + Add Employee
                  </button>
                </div>
                {employees.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No employees available</p>
                )}
                {formData.employeesInvolved.map((emp, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <select
                      value={emp.userId}
                      onChange={(e) => updateEmployee(index, "userId", e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                    >
                      <option value="">Select employee</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name || e.email || "Unknown"}
                        </option>
                      ))}
                    </select>
                    <select
                      value={emp.role}
                      onChange={(e) => updateEmployee(index, "role", e.target.value)}
                      className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="INVOLVED">Involved</option>
                      <option value="WITNESS">Witness</option>
                      <option value="INJURED">Injured</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeEmployee(index)}
                      className="text-red-600 hover:text-red-800 px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Photo Upload */}
              <PhotoUploadSection />

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 text-base sm:text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 text-base sm:text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center"
                >
                  {submitting ? "Creating..." : "Create Report"}
                </button>
              </div>
            </form>
      </MobileModal>

      {/* Detail/Edit Modal */}
      <MobileModal
        isOpen={showDetailModal && !!selectedReport}
        onClose={() => {
          setShowDetailModal(false);
          setIsEditing(false);
          setSelectedReport(null);
        }}
        title={isEditing ? "Edit Incident Report" : "Incident Report Details"}
      >
        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.incidentDate}
                      onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as IncidentStatus })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                    >
                      <option value="OPEN">Open</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Severity *</label>
                    <select
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value as IncidentSeverity })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Injury Details</label>
                  <textarea
                    rows={2}
                    value={formData.injuryDetails}
                    onChange={(e) => setFormData({ ...formData, injuryDetails: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Related Job</label>
                  <select
                    value={formData.jobId}
                    onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                  >
                    <option value="">No related job</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.jobNumber || `#${job.id.slice(0, 8).toUpperCase()}`} - {job.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Employees Involved */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Employees Involved</label>
                    <button
                      type="button"
                      onClick={addEmployee}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      + Add Employee
                    </button>
                  </div>
                  {formData.employeesInvolved.map((emp, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <select
                        value={emp.userId}
                        onChange={(e) => updateEmployee(index, "userId", e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base min-h-[44px]"
                      >
                        <option value="">Select employee</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name || e.email || "Unknown"}
                          </option>
                        ))}
                      </select>
                      <select
                        value={emp.role}
                        onChange={(e) => updateEmployee(index, "role", e.target.value)}
                        className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="INVOLVED">Involved</option>
                        <option value="WITNESS">Witness</option>
                        <option value="INJURED">Injured</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeEmployee(index)}
                        className="text-red-600 hover:text-red-800 px-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Photo Upload */}
                <PhotoUploadSection />

                <div className="flex justify-between pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => selectedReport && handleDelete(selectedReport.id)}
                    className="px-6 py-3 text-base sm:text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] flex items-center justify-center"
                  >
                    Delete
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-6 py-3 text-base sm:text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] flex items-center justify-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-3 text-base sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center"
                    >
                      {submitting ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            ) : selectedReport ? (
              <div className="p-6 space-y-4">
                <div className="flex gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      statusColors[selectedReport.status]
                    }`}
                  >
                    {selectedReport.status.replace("_", " ")}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      severityColors[selectedReport.severity]
                    }`}
                  >
                    {selectedReport.severity}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedReport.title}</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Date:</span>
                    <span className="ml-2 text-gray-900">
                      {new Date(selectedReport.incidentDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Location:</span>
                    <span className="ml-2 text-gray-900">{selectedReport.location}</span>
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-500">Description:</span>
                  <p className="mt-1 text-gray-900 whitespace-pre-wrap">{selectedReport.description}</p>
                </div>

                {selectedReport.injuryDetails && (
                  <div>
                    <span className="text-sm text-gray-500">Injury Details:</span>
                    <p className="mt-1 text-gray-900">{selectedReport.injuryDetails}</p>
                  </div>
                )}

                {selectedReport.job && (
                  <div>
                    <span className="text-sm text-gray-500">Related Job:</span>
                    <p className="mt-1 text-gray-900">{selectedReport.job.jobNumber || `#${selectedReport.job.id.slice(0, 8).toUpperCase()}`} - {selectedReport.job.title}</p>
                  </div>
                )}

                {selectedReport.employeesInvolved.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500">Employees Involved:</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedReport.employeesInvolved.map((emp) => (
                        <span
                          key={emp.id}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            roleColors[emp.role]
                          }`}
                        >
                          {emp.user.name || emp.user.email} ({emp.role})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Photos display */}
                {selectedReport.photos && selectedReport.photos.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500">Photos:</span>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {selectedReport.photos.map((photo, index) => (
                        <a
                          key={index}
                          href={photo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={photo}
                            alt={`Incident photo ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  Created by {selectedReport.createdBy.name || selectedReport.createdBy.email} on{" "}
                  {new Date(selectedReport.createdAt).toLocaleDateString()}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedReport(null);
                    }}
                    className="px-6 py-3 text-base sm:text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] flex items-center justify-center"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ) : null}
      </MobileModal>
    </div>
  );
}
