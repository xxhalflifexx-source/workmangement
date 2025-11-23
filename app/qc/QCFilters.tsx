"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

interface QCFiltersProps {
  workers: Array<{ id: string; name: string | null }>;
}

export default function QCFilters({ workers }: QCFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "ALL"
  );
  const [workerFilter, setWorkerFilter] = useState(
    searchParams.get("worker") || ""
  );
  const [dateFrom, setDateFrom] = useState(
    searchParams.get("dateFrom") || ""
  );
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");

  const applyFilters = () => {
    const params = new URLSearchParams();
    const search = searchParams.get("q");
    if (search) params.set("q", search);
    if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
    if (workerFilter) params.set("worker", workerFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (searchParams.get("qc") === "ok") params.set("qc", "ok");

    router.push(`/qc?${params.toString()}`);
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    const search = searchParams.get("q");
    if (search) params.set("q", search);
    if (searchParams.get("qc") === "ok") params.set("qc", "ok");
    setStatusFilter("ALL");
    setWorkerFilter("");
    setDateFrom("");
    setDateTo("");
    router.push(`/qc?${params.toString()}`);
  };

  // Auto-apply filters when they change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      const search = searchParams.get("q");
      if (search) params.set("q", search);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (workerFilter) params.set("worker", workerFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (searchParams.get("qc") === "ok") params.set("qc", "ok");

      const newUrl = `/qc?${params.toString()}`;
      if (window.location.search !== `?${params.toString()}`) {
        router.push(newUrl);
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, workerFilter, dateFrom, dateTo]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            <option value="PENDING">Pending (Submit to QC)</option>
            <option value="IN_PROGRESS">In Progress (Rework)</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Worker
          </label>
          <select
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Workers</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name || "Unknown"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Date From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Date To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-200 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}

