"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

interface JobFiltersProps {
  customers: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string | null }>;
}

export default function JobFilters({ customers, users }: JobFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "ALL"
  );
  const [customerFilter, setCustomerFilter] = useState(
    searchParams.get("customer") || ""
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
    if (customerFilter) params.set("customer", customerFilter);
    if (workerFilter) params.set("worker", workerFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    router.push(`/jobs?${params.toString()}`);
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    const search = searchParams.get("q");
    if (search) params.set("q", search);
    setStatusFilter("ALL");
    setCustomerFilter("");
    setWorkerFilter("");
    setDateFrom("");
    setDateTo("");
    router.push(`/jobs?${params.toString()}`);
  };

  // Auto-apply filters when they change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      const search = searchParams.get("q");
      if (search) params.set("q", search);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (customerFilter) params.set("customer", customerFilter);
      if (workerFilter) params.set("worker", workerFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const newUrl = `/jobs?${params.toString()}`;
      if (window.location.search !== `?${params.toString()}`) {
        router.push(newUrl);
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, customerFilter, workerFilter, dateFrom, dateTo]);

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
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="AWAITING_QC">Submit to QC</option>
            <option value="REWORK">Rework</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Client
          </label>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Clients</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Assigned Worker
          </label>
          <select
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Workers</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || "Unknown"}
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

