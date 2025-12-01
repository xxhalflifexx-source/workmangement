"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

interface JobFiltersProps {
  customers: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string | null }>;
  statusFilter?: string;
  customerFilter?: string;
  workerFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  onStatusChange?: (value: string) => void;
  onCustomerChange?: (value: string) => void;
  onWorkerChange?: (value: string) => void;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
}

export default function JobFilters({ 
  customers, 
  users,
  statusFilter: externalStatusFilter,
  customerFilter: externalCustomerFilter,
  workerFilter: externalWorkerFilter,
  dateFrom: externalDateFrom,
  dateTo: externalDateTo,
  onStatusChange,
  onCustomerChange,
  onWorkerChange,
  onDateFromChange,
  onDateToChange,
}: JobFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Use external state if provided, otherwise use internal state
  const [internalStatusFilter, setInternalStatusFilter] = useState(
    searchParams.get("status") || "ALL"
  );
  const [internalCustomerFilter, setInternalCustomerFilter] = useState(
    searchParams.get("customer") || ""
  );
  const [internalWorkerFilter, setInternalWorkerFilter] = useState(
    searchParams.get("worker") || ""
  );
  const [internalDateFrom, setInternalDateFrom] = useState(
    searchParams.get("dateFrom") || ""
  );
  const [internalDateTo, setInternalDateTo] = useState(searchParams.get("dateTo") || "");
  
  const statusFilter = externalStatusFilter !== undefined ? externalStatusFilter : internalStatusFilter;
  const customerFilter = externalCustomerFilter !== undefined ? externalCustomerFilter : internalCustomerFilter;
  const workerFilter = externalWorkerFilter !== undefined ? externalWorkerFilter : internalWorkerFilter;
  const dateFrom = externalDateFrom !== undefined ? externalDateFrom : internalDateFrom;
  const dateTo = externalDateTo !== undefined ? externalDateTo : internalDateTo;
  
  const setStatusFilter = onStatusChange || setInternalStatusFilter;
  const setCustomerFilter = onCustomerChange || setInternalCustomerFilter;
  const setWorkerFilter = onWorkerChange || setInternalWorkerFilter;
  const setDateFrom = onDateFromChange || setInternalDateFrom;
  const setDateTo = onDateToChange || setInternalDateTo;

  const clearFilters = () => {
    setStatusFilter("ALL");
    setCustomerFilter("");
    setWorkerFilter("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-end gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm min-h-[44px]"
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

        <div className="flex-1 min-w-0">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            Client
          </label>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm min-h-[44px]"
          >
            <option value="">All Clients</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-0">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            Assigned Worker
          </label>
          <select
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm min-h-[44px]"
          >
            <option value="">All Workers</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || "Unknown"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-0">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            Date From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm min-h-[44px]"
          />
        </div>

        <div className="flex-1 min-w-0">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
            Date To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm min-h-[44px]"
          />
        </div>

        <div className="w-full md:w-auto">
          <button
            type="button"
            onClick={clearFilters}
            className="w-full md:w-auto px-4 py-2.5 sm:py-2 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-200 transition-colors min-h-[44px]"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}

