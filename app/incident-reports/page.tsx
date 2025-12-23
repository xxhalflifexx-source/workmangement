"use client";

import { useState, useEffect } from "react";
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
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<IncidentReportWithRelations | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "">("");
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | "">("");
  
  // Form state
  const [jobs, setJobs] = useState<{ id: string; title: string; status: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string | null; email: string | null; role: string }[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    incidentDate: new Date().toISOString().split("T")[0],
    location: "",
    injuryDetails: "",
    witnesses: "",
    severity: "LOW" as IncidentSeverity,
    status: "OPEN" as IncidentStatus,
    jobId: "",
    employeesInvolved: [] as { userId: string; role: EmployeeRole }[],
    photos: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);

  // Check authentication and role
  useEffect(() => {
    if (status === "loading") return;
    
    if (!session?.user) {
      router.push("/login");
      return;
    }
    
    const role = (session.user as any).role;
    if (role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    
    loadData();
  }, [session, status, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportsRes, jobsRes, employeesRes] = await Promise.all([
        getIncidentReports({
          status: statusFilter || undefined,
          severity: severityFilter || undefined,
        }),
        getJobsForIncident(),
        getEmployeesForIncident(),
      ]);

      if (reportsRes.ok && reportsRes.reports) {
        setReports(reportsRes.reports as IncidentReportWithRelations[]);
      } else {
        setError(reportsRes.error || "Failed to load reports");
      }

      if (jobsRes.ok && jobsRes.jobs) {
        setJobs(jobsRes.jobs);
      }

      if (employeesRes.ok && employeesRes.employees) {
        setEmployees(employeesRes.employees);
      }
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Reload when filters change
  useEffect(() => {
    if (session?.user && (session.user as any).role === "ADMIN") {
      loadData();
    }
  }, [statusFilter, severityFilter]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      incidentDate: new Date().toISOString().split("T")[0],
      location: "",
      injuryDetails: "",
      witnesses: "",
      severity: "LOW",
      status: "OPEN",
      jobId: "",
      employeesInvolved: [],
      photos: [],
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const res = await createIncidentReport({
        title: formData.title,
        description: formData.description,
        incidentDate: new Date(formData.incidentDate),
        location: formData.location,
        injuryDetails: formData.injuryDetails || undefined,
        witnesses: formData.witnesses || undefined,
        severity: formData.severity,
        jobId: formData.jobId || undefined,
        employeesInvolved: formData.employeesInvolved.length > 0 ? formData.employeesInvolved : undefined,
        photos: formData.photos.length > 0 ? formData.photos : undefined,
      });

      if (res.ok) {
        setShowCreateModal(false);
        resetForm();
        loadData();
      } else {
        setError(res.error || "Failed to create incident report");
      }
    } catch (err) {
      setError("Failed to create incident report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    
    setSubmitting(true);
    
    try {
      const res = await updateIncidentReport(selectedReport.id, {
        title: formData.title,
        description: formData.description,
        incidentDate: new Date(formData.incidentDate),
        location: formData.location,
        injuryDetails: formData.injuryDetails || undefined,
        witnesses: formData.witnesses || undefined,
        status: formData.status,
        severity: formData.severity,
        jobId: formData.jobId || null,
        employeesInvolved: formData.employeesInvolved,
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
      witnesses: report.witnesses || "",
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

  if (status === "loading" || loading) {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-white hover:text-gray-300 transition-colors">
              ← Back
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-white">⚠️ Incident Reports</h1>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>+</span> New Report
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | "")}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as IncidentSeverity | "")}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-900 font-bold">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Reports List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {reports.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg">No incident reports found</p>
              <p className="text-sm mt-2">Create a new report to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employees
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
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{report.title}</div>
                        <div className="text-sm text-gray-500 line-clamp-1">{report.description}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {new Date(report.incidentDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{report.location}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            statusColors[report.status] || statusColors.OPEN
                          }`}
                        >
                          {report.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            severityColors[report.severity] || severityColors.LOW
                          }`}
                        >
                          {report.severity}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {report.job?.title || "-"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {report.employeesInvolved.length > 0
                          ? report.employeesInvolved.length + " person(s)"
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">New Incident Report</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Where did it occur?"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity *</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as IncidentSeverity })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Detailed description of what happened..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Injury Details</label>
                <textarea
                  rows={2}
                  value={formData.injuryDetails}
                  onChange={(e) => setFormData({ ...formData, injuryDetails: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Any injuries sustained..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Witnesses</label>
                <input
                  type="text"
                  value={formData.witnesses}
                  onChange={(e) => setFormData({ ...formData, witnesses: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Names of witnesses (comma-separated)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Related Job</label>
                <select
                  value={formData.jobId}
                  onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">No related job</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
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
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select employee</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name || e.email}
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
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail/Edit Modal */}
      {showDetailModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditing ? "Edit Incident Report" : "Incident Report Details"}
                </h2>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setIsEditing(false);
                    setSelectedReport(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdate} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as IncidentStatus })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Injury Details</label>
                  <textarea
                    rows={2}
                    value={formData.injuryDetails}
                    onChange={(e) => setFormData({ ...formData, injuryDetails: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Witnesses</label>
                  <input
                    type="text"
                    value={formData.witnesses}
                    onChange={(e) => setFormData({ ...formData, witnesses: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Related Job</label>
                  <select
                    value={formData.jobId}
                    onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">No related job</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
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
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select employee</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name || e.email}
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
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedReport.id)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {submitting ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
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

                {selectedReport.witnesses && (
                  <div>
                    <span className="text-sm text-gray-500">Witnesses:</span>
                    <p className="mt-1 text-gray-900">{selectedReport.witnesses}</p>
                  </div>
                )}

                {selectedReport.job && (
                  <div>
                    <span className="text-sm text-gray-500">Related Job:</span>
                    <p className="mt-1 text-gray-900">{selectedReport.job.title}</p>
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
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

