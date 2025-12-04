"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustInventory,
  getItemAdjustments,
} from "./actions";
import { getMaterialRequests, updateMaterialRequest, createMaterialRequest, getInventoryItemsForRequest, getNextRequestNumber } from "../material-requests/actions";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDateTime, nowInCentral, centralToUTC } from "@/lib/date-utils";
import { InventoryErrorBoundary } from "./error-boundary";

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  quantity: number;
  unit: string;
  minStockLevel: number;
  location: string | null;
  supplier: string | null;
  costPerUnit: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Adjustment {
  id: string;
  quantityChange: number;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string | null;
  };
}

interface MaterialRequest {
  id: string;
  requestNumber: string | null;
  itemName: string;
  quantity: number;
  unit: string;
  description: string | null;
  priority: string;
  status: string;
  amount: number | null;
  requestedDate: string;
  fulfilledDate: string | null;
  dateDelivered: string | null;
  notes: string | null;
  recommendedAction: string | null;
  orderStatus: string | null;
  job: {
    id: string;
    title: string;
  } | null;
  user: {
    name: string | null;
    email: string | null;
  };
}

interface InventoryItemForRequest {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minStockLevel: number;
}

export default function InventoryPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const canManage = userRole === "MANAGER" || userRole === "ADMIN";
  const isAdmin = userRole === "ADMIN";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"inventory" | "materials">("inventory");
  
  // Inventory tab filters and sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStockStatus, setFilterStockStatus] = useState("ALL");
  const [sortField, setSortField] = useState<"name" | "quantity" | "location" | "updatedAt">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Materials Requested tab filters and sorting
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestSearchTerm, setRequestSearchTerm] = useState("");
  const [filterRequestStatus, setFilterRequestStatus] = useState("ALL");
  const [filterRequestJob, setFilterRequestJob] = useState("ALL");
  const [filterRequester, setFilterRequester] = useState("ALL");
  const [filterItem, setFilterItem] = useState("ALL");
  const [filterAction, setFilterAction] = useState("ALL");
  const [requestSortField, setRequestSortField] = useState<"requestNumber" | "requestedDate" | "itemName" | "quantity" | "fulfilledDate">("requestedDate");
  const [requestSortDirection, setRequestSortDirection] = useState<"asc" | "desc">("desc");
  const [requestCurrentPage, setRequestCurrentPage] = useState(1);
  const requestsPerPage = 20;
  
  // Material request submission form state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestItemName, setRequestItemName] = useState("");
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [requestUnit, setRequestUnit] = useState("pcs");
  const [requestNotes, setRequestNotes] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [inventoryItemsForRequest, setInventoryItemsForRequest] = useState<InventoryItemForRequest[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      setSuccess(undefined);

      console.log("[Inventory] Loading inventory items...");
      const res = await getInventoryItems();

      if (res.ok) {
        console.log("[Inventory] Inventory items loaded:", res.items?.length || 0, "items");
        setItems(res.items as any);
      } else {
        console.error("[Inventory] Failed to load inventory items:", res.error);
        setError(res.error || "Failed to load inventory items");
      }
    } catch (error: any) {
      console.error("[Inventory] Exception loading inventory items:", error);
      setError(`Failed to load inventory items: ${error?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMaterialRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await getMaterialRequests();
      if (res.ok) {
        setMaterialRequests(res.requests as any);
      } else {
        console.error("[Inventory] loadMaterialRequests error:", res.error);
        setError(res.error);
      }
    } catch (e: any) {
      console.error("[Inventory] loadMaterialRequests exception:", e);
      setError("Failed to load material requests");
    }
    setLoadingRequests(false);
  }, []);

  useEffect(() => {
    // Global error handlers for better error tracking
    const handleError = (event: ErrorEvent) => {
      console.error("[Inventory] Global error:", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[Inventory] Unhandled promise rejection:", {
        reason: event.reason,
        promise: event.promise,
        timestamp: new Date().toISOString(),
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    const initializeData = async () => {
      try {
        console.log("[Inventory] Initializing data load...");
        await Promise.all([loadData(), loadMaterialRequests()]);
        console.log("[Inventory] Data loaded successfully");
      } catch (error: any) {
        console.error("[Inventory] Failed to initialize data:", error);
        setError(`Failed to load data: ${error?.message || "Unknown error"}`);
      }
    };
    initializeData();

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [loadData, loadMaterialRequests]);

  // Load inventory items when request form is opened
  useEffect(() => {
    if (showRequestForm) {
      const loadInventoryItems = async () => {
        try {
          const res = await getInventoryItemsForRequest();
          if (res.ok) {
            setInventoryItemsForRequest(res.items as any);
          }
        } catch (e) {
          console.error("Failed to load inventory items for request", e);
        }
      };
      loadInventoryItems();
    }
  }, [showRequestForm]);

  const handleUpdateRequestStatus = useCallback(async (requestId: string, status: string, amount?: number | null) => {
    setError(undefined);
    
    // Check if amount is required (for APPROVED or FULFILLED status)
    if ((status === "APPROVED" || status === "FULFILLED") && (!amount || amount <= 0)) {
      setError("Amount is required before updating status to APPROVED or FULFILLED");
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append("status", status);
      if (amount !== undefined && amount !== null) {
        formData.append("amount", amount.toString());
      }
      const res = await updateMaterialRequest(requestId, formData);
      if (!res.ok) {
        console.error("[Inventory] handleUpdateRequestStatus error:", res.error, "requestId:", requestId, "status:", status);
        setError(res.error);
        return;
      }
      // Update local state
      setMaterialRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status, amount: amount || r.amount, fulfilledDate: status === "FULFILLED" ? centralToUTC(nowInCentral().toDate()).toISOString() : r.fulfilledDate } : r)));
      setSuccess(`Request ${status.toLowerCase()} successfully`);
    } catch (e: any) {
      console.error("[Inventory] handleUpdateRequestStatus exception:", e, "requestId:", requestId, "status:", status);
      setError("Failed to update request status");
    }
  }, []);

  const handleSubmitMaterialRequest = useCallback(async () => {
    try {
      if (!requestItemName || !requestQuantity || !requestUnit) {
        setError("Please fill in all required fields");
        return;
      }

      console.log("[Inventory] Submitting material request:", { requestItemName, requestQuantity, requestUnit, requestNotes });
      setSubmittingRequest(true);
      setError(undefined);
      setSuccess(undefined);

      const formData = new FormData();
      formData.append("itemName", requestItemName);
      formData.append("quantity", requestQuantity.toString());
      formData.append("unit", requestUnit);
      formData.append("priority", "MEDIUM");
      if (requestNotes) {
        formData.append("notes", requestNotes);
      }

      const res = await createMaterialRequest(formData);

      if (!res.ok) {
        console.error("[Inventory] Failed to submit material request:", res.error);
        setError(res.error || "Failed to submit material request");
        setSubmittingRequest(false);
        return;
      }

      console.log("[Inventory] Material request submitted successfully");
      setSuccess("Material request submitted successfully!");
      setShowRequestForm(false);
      setRequestItemName("");
      setRequestQuantity(1);
      setRequestUnit("pcs");
      setRequestNotes("");
      setSubmittingRequest(false);
      await loadMaterialRequests();
    } catch (error: any) {
      console.error("[Inventory] Exception submitting material request:", error);
      setError(`Failed to submit material request: ${error?.message || "Unknown error"}`);
      setSubmittingRequest(false);
    }
  }, [loadMaterialRequests]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const formData = new FormData(e.currentTarget);

    const res = editingItem
      ? await updateInventoryItem(editingItem.id, formData)
      : await createInventoryItem(formData);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSuccess(editingItem ? "Item updated successfully!" : "Item created successfully!");
    setShowModal(false);
    setEditingItem(null);
    loadData();
  }, [editingItem, loadData]);

  const handleDelete = useCallback(async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item? This will also delete all adjustment history.")) return;

    const res = await deleteInventoryItem(itemId);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSuccess("Item deleted successfully!");
    loadData();
  }, [loadData]);

  const handleAdjustSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const formData = new FormData(e.currentTarget);

    const res = await adjustInventory(formData);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSuccess(`Inventory adjusted! New quantity: ${res.item?.quantity} ${res.item?.unit}`);
    setShowAdjustModal(false);
    setAdjustingItem(null);
    loadData();
  }, [loadData]);

  const openCreateModal = useCallback(() => {
    setEditingItem(null);
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((item: InventoryItem) => {
    setEditingItem(item);
    setShowModal(true);
  }, []);

  const openAdjustModal = useCallback((item: InventoryItem) => {
    setAdjustingItem(item);
    setShowAdjustModal(true);
  }, []);

  const openHistoryModal = useCallback(async (item: InventoryItem) => {
    setHistoryItem(item);
    setShowHistoryModal(true);
    setLoadingHistory(true);

    const res = await getItemAdjustments(item.id);
    if (res.ok) {
      setAdjustments(res.adjustments as any);
    }
    setLoadingHistory(false);
  }, []);

  const getStockStatus = useCallback((item: InventoryItem) => {
    if (item.quantity === 0) return { text: "Out of Stock", color: "bg-red-100 text-red-800", icon: "🚨" };
    if (item.quantity <= item.minStockLevel) return { text: "Low Stock", color: "bg-orange-100 text-orange-800", icon: "⚠️" };
    return { text: "In Stock", color: "bg-green-100 text-green-800", icon: "✓" };
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category).filter(Boolean))) as string[];
  }, [items]);

  // Inventory tab: Filtering and sorting
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = filterCategory === "ALL" || item.category === filterCategory;

      const stockStatus = getStockStatus(item);
      const matchesStockStatus =
        filterStockStatus === "ALL" ||
        (filterStockStatus === "LOW" && (item.quantity === 0 || item.quantity <= item.minStockLevel)) ||
        (filterStockStatus === "IN_STOCK" && item.quantity > item.minStockLevel);

      return matchesSearch && matchesCategory && matchesStockStatus;
    });
  }, [items, searchTerm, filterCategory, filterStockStatus, getStockStatus]);

  // Sort inventory items
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "quantity":
          aVal = a.quantity;
          bVal = b.quantity;
          break;
        case "location":
          aVal = (a.location || "").toLowerCase();
          bVal = (b.location || "").toLowerCase();
          break;
        case "updatedAt":
          aVal = new Date(a.updatedAt).getTime();
          bVal = new Date(b.updatedAt).getTime();
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDirection]);

  // Paginate inventory items
  const totalInventoryPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    return sortedItems.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [sortedItems, currentPage, itemsPerPage]);

  // Materials Requested tab: Filtering and sorting
  const filteredRequests = useMemo(() => {
    return materialRequests.filter((req) => {
      const jobNumber = req.job ? req.job.id.substring(0, 8).toUpperCase() : "";
      const matchesSearch =
        requestSearchTerm === "" ||
        (req.requestNumber || "").toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
        jobNumber.toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
        req.itemName.toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
        req.description?.toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
        (req.job?.title || "").toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
        (req.user.name || req.user.email || "").toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
        req.status.toLowerCase().includes(requestSearchTerm.toLowerCase());

      const matchesStatus = filterRequestStatus === "ALL" || req.status === filterRequestStatus;
      const matchesJob = filterRequestJob === "ALL" || (filterRequestJob === "NO_JOB" && !req.job) || req.job?.id === filterRequestJob;
      const matchesRequester = filterRequester === "ALL" || req.user.email === filterRequester;
      const matchesItem = filterItem === "ALL" || req.itemName.toLowerCase() === filterItem.toLowerCase();
      const matchesAction = filterAction === "ALL" || (req.recommendedAction || "PENDING") === filterAction;

      return matchesSearch && matchesStatus && matchesJob && matchesRequester && matchesItem && matchesAction;
    });
  }, [materialRequests, requestSearchTerm, filterRequestStatus, filterRequestJob, filterRequester, filterItem, filterAction]);

  // Sort material requests
  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (requestSortField) {
        case "requestNumber":
          aVal = a.requestNumber || "";
          bVal = b.requestNumber || "";
          break;
        case "requestedDate":
          aVal = new Date(a.requestedDate).getTime();
          bVal = new Date(b.requestedDate).getTime();
          break;
        case "itemName":
          aVal = a.itemName.toLowerCase();
          bVal = b.itemName.toLowerCase();
          break;
        case "quantity":
          aVal = a.quantity;
          bVal = b.quantity;
          break;
        case "fulfilledDate":
          aVal = a.fulfilledDate ? new Date(a.fulfilledDate).getTime() : 0;
          bVal = b.fulfilledDate ? new Date(b.fulfilledDate).getTime() : 0;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return requestSortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return requestSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRequests, requestSortField, requestSortDirection]);

  // Paginate material requests
  const totalRequestPages = Math.ceil(sortedRequests.length / requestsPerPage);
  const paginatedRequests = useMemo(() => {
    return sortedRequests.slice(
      (requestCurrentPage - 1) * requestsPerPage,
      requestCurrentPage * requestsPerPage
    );
  }, [sortedRequests, requestCurrentPage, requestsPerPage]);

  // Get unique values for filters
  const uniqueJobs = Array.from(new Set(materialRequests.map((r) => r.job?.id).filter(Boolean)));
  const uniqueRequesters = Array.from(new Set(materialRequests.map((r) => r.user.email).filter(Boolean)));
  const uniqueItems = Array.from(new Set(materialRequests.map((r) => r.itemName))).sort();

  // Helper functions (must be defined before export functions that use them)
  const formatDate = useCallback((dateString: string) => {
    return formatDateTime(dateString);
  }, []);

  const formatCurrency = useCallback((amount: number | null) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }, []);

  // Get current stock for an item
  const getCurrentStock = useCallback((itemName: string): number => {
    const inventoryItem = items.find((item) => item.name.toLowerCase() === itemName.toLowerCase());
    return inventoryItem ? inventoryItem.quantity : 0;
  }, [items]);

  // Get recommended action (manual only, no auto-calculation)
  const getRecommendedAction = useCallback((req: MaterialRequest): string => {
    return req.recommendedAction || "PENDING"; // Return stored value or default to PENDING
  }, []);

  // Export functions
  const exportInventoryToCSV = useCallback(() => {
    const headers = ["Item Name", "SKU", "Category", "Quantity", "Unit", "Location", "Status", "Last Updated"];
    const rows = sortedItems.map((item) => {
      const status = getStockStatus(item);
      return [
        item.name,
        item.sku || "",
        item.category || "",
        Math.floor(item.quantity).toString(),
        item.unit,
        item.location || "",
        status.text,
        formatDate(item.updatedAt),
      ];
    });
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedItems, getStockStatus, formatDate]);

  const exportRequestsToCSV = useCallback(() => {
    const headers = ["Job No.", "Employee", "Item", "Qty Requested", "Availability", "Action", "Amount", "Order Status", "Date Requested", "Date Approved", "Notes"];
    const rows = sortedRequests.map((req) => {
      const currentStock = getCurrentStock(req.itemName);
      const recommendedAction = getRecommendedAction(req);
      const inventoryItem = items.find((item) => item.name.toLowerCase() === req.itemName.toLowerCase());
      const availability = inventoryItem ? (currentStock >= req.quantity ? "Available" : "Unavailable") : "Unavailable";
      const dateApproved = req.fulfilledDate ? formatDate(req.fulfilledDate) : "";
      const orderStatus = req.orderStatus === "TO_ORDER" ? "To Order" : req.orderStatus === "ORDERED" ? "Ordered" : req.orderStatus === "RECEIVED" ? "Received" : "";
      return [
        req.job ? req.job.id.substring(0, 8).toUpperCase() : "",
        req.user.name || req.user.email || "",
        req.itemName,
        `${req.quantity} ${req.unit}`,
        availability,
        recommendedAction === "APPROVE" ? "Approve" : recommendedAction === "PARTIAL" ? "Partial" : recommendedAction === "REJECTED" ? "Rejected" : "Pending",
        req.amount ? formatCurrency(req.amount) : "",
        orderStatus,
        formatDate(req.requestedDate),
        dateApproved,
        req.notes || "",
      ];
    });
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `material-requests-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedRequests, getCurrentStock, getRecommendedAction, items, formatDate, formatCurrency]);

  const lowStockCount = useMemo(() => {
    return items.filter((item) => item.quantity > 0 && item.quantity <= item.minStockLevel).length;
  }, [items]);

  const outOfStockCount = useMemo(() => {
    return items.filter((item) => item.quantity === 0).length;
  }, [items]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inventory...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-xs sm:text-sm text-gray-500">Track and manage your inventory items</p>
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

        {/* Stock Alerts - Only show on Inventory tab */}
        {activeTab === "inventory" && (lowStockCount > 0 || outOfStockCount > 0) && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {outOfStockCount > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-center gap-3">
                <span className="text-3xl">🚨</span>
                <div>
                  <p className="font-bold text-red-900">Out of Stock</p>
                  <p className="text-sm text-red-700">{outOfStockCount} item(s) need restocking</p>
                </div>
              </div>
            )}
            {lowStockCount > 0 && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 flex items-center gap-3">
                <span className="text-3xl">⚠️</span>
                <div>
                  <p className="font-bold text-orange-900">Low Stock Warning</p>
                  <p className="text-sm text-orange-700">{lowStockCount} item(s) running low</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => {
                  setActiveTab("inventory");
                  setCurrentPage(1);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "inventory"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Inventory
              </button>
              <button
                onClick={() => {
                  setActiveTab("materials");
                  setRequestCurrentPage(1);
                  if (materialRequests.length === 0) {
                    loadMaterialRequests();
                  }
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "materials"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Materials Requested
              </button>
            </nav>
          </div>
        </div>

        {/* Inventory Tab Content */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
        {/* Controls */}
            <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-4">
            <div className="flex-1 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search by name, SKU, or description..."
                value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
              />
            </div>

                <div className="flex gap-2">
                  <button
                    onClick={exportInventoryToCSV}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    📥 Export CSV
                  </button>
            {canManage && (
              <button
                onClick={openCreateModal}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
              >
                + Add Item
              </button>
            )}
                </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setCurrentPage(1);
                  }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={filterStockStatus}
                  onChange={(e) => {
                    setFilterStockStatus(e.target.value);
                    setCurrentPage(1);
                  }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ALL">All Stock Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW">Low/Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Inventory Table */}
        {loading ? (
          <div className="text-center py-12 bg-white rounded-xl shadow">
            <div className="text-gray-500">Loading inventory...</div>
          </div>
            ) : sortedItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {items.length === 0 ? "No inventory items yet" : "No items match your search"}
            </h3>
            <p className="text-gray-600 mb-6">
              {items.length === 0
                ? canManage
                  ? "Add your first inventory item to get started"
                  : "No items in inventory yet"
                : "Try adjusting your filters or search term"}
            </p>
            {canManage && items.length === 0 && (
              <button
                onClick={openCreateModal}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Add First Item
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                          <button
                            onClick={() => {
                              setSortField("name");
                              setSortDirection(sortField === "name" && sortDirection === "asc" ? "desc" : "asc");
                            }}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Item Name
                            {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                          </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                          <button
                            onClick={() => {
                              setSortField("quantity");
                              setSortDirection(sortField === "quantity" && sortDirection === "asc" ? "desc" : "asc");
                            }}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Quantity
                            {sortField === "quantity" && (sortDirection === "asc" ? "↑" : "↓")}
                          </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                          <button
                            onClick={() => {
                              setSortField("location");
                              setSortDirection(sortField === "location" && sortDirection === "asc" ? "desc" : "asc");
                            }}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Location
                            {sortField === "location" && (sortDirection === "asc" ? "↑" : "↓")}
                          </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                          <button
                            onClick={() => {
                              setSortField("updatedAt");
                              setSortDirection(sortField === "updatedAt" && sortDirection === "asc" ? "desc" : "asc");
                            }}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Last Updated
                            {sortField === "updatedAt" && (sortDirection === "asc" ? "↑" : "↓")}
                          </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedItems.map((item) => {
                    const stockStatus = getStockStatus(item);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{item.name}</div>
                          {item.sku && (
                            <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                          )}
                          {item.description && (
                            <div className="text-xs text-gray-500 line-clamp-1">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.category ? (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              {item.category}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {Math.floor(item.quantity)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.location || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${stockStatus.color}`}
                          >
                            {stockStatus.icon} {stockStatus.text}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(item.updatedAt)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm space-x-2">
                          <button
                            onClick={() => openHistoryModal(item)}
                            className="text-gray-600 hover:text-gray-900"
                            title="View history"
                          >
                            📊
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => openAdjustModal(item)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Adjust quantity"
                              >
                                ±
                              </button>
                              <button
                                onClick={() => openEditModal(item)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                Edit
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

            {/* Pagination */}
            {totalInventoryPages > 1 && (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-4 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedItems.length)} of {sortedItems.length} items
      </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalInventoryPages) }, (_, i) => {
                    let pageNum;
                    if (totalInventoryPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalInventoryPages - 2) {
                      pageNum = totalInventoryPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 border rounded-lg ${
                          currentPage === pageNum
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalInventoryPages, currentPage + 1))}
                    disabled={currentPage === totalInventoryPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Materials Requested Tab Content */}
        {activeTab === "materials" && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-4">
                <div className="flex-1 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Search by Job No., Request ID, Employee, Item, or Status..."
                    value={requestSearchTerm}
                    onChange={(e) => {
                      setRequestSearchTerm(e.target.value);
                      setRequestCurrentPage(1);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  {userRole === "EMPLOYEE" && (
                    <button
                      onClick={() => setShowRequestForm(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                    >
                      + Submit Request
                    </button>
                  )}
                  <button
                    onClick={exportRequestsToCSV}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    📥 Export CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Employee Filter - aligned to Employee column */}
                <select
                  value={filterRequester}
                  onChange={(e) => {
                    setFilterRequester(e.target.value);
                    setRequestCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm min-h-[44px]"
                >
                  <option value="ALL">All Employees</option>
                  {materialRequests
                    .map((r) => r.user.email)
                    .filter((email): email is string => email !== null && email !== undefined)
                    .filter((email, index, self) => index === self.indexOf(email))
                    .sort()
                    .map((email) => {
                      const user = materialRequests.find((r) => r.user.email === email)?.user;
                      return (
                        <option key={email} value={email}>
                          {user?.name || email}
                        </option>
                      );
                    })}
                </select>

                {/* Item Filter - aligned to Item column */}
                <select
                  value={filterItem}
                  onChange={(e) => {
                    setFilterItem(e.target.value);
                    setRequestCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm min-h-[44px]"
                >
                  <option value="ALL">All Items</option>
                  {uniqueItems.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                {/* Action Filter - aligned to Action column */}
                <select
                  value={filterAction}
                  onChange={(e) => {
                    setFilterAction(e.target.value);
                    setRequestCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm min-h-[44px]"
                >
                  <option value="ALL">All Actions</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVE">Approve</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                {/* Status Filter */}
                <select
                  value={filterRequestStatus}
                  onChange={(e) => {
                    setFilterRequestStatus(e.target.value);
                    setRequestCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm min-h-[44px]"
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {/* Materials Requested Table */}
            {loadingRequests ? (
              <div className="text-center py-12 bg-white rounded-xl shadow">
                <div className="text-gray-500">Loading material requests...</div>
              </div>
            ) : sortedRequests.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-12 text-center">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {materialRequests.length === 0 ? "No material requests yet" : "No requests match your search"}
                </h3>
                <p className="text-gray-600">
                  {materialRequests.length === 0
                    ? "Material requests will appear here when employees submit them"
                    : "Try adjusting your filters or search term"}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job No.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          <button
                            onClick={() => {
                              setRequestSortField("requestedDate");
                              setRequestSortDirection(requestSortField === "requestedDate" && requestSortDirection === "asc" ? "desc" : "asc");
                            }}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Employee
                            {requestSortField === "requestedDate" && (requestSortDirection === "asc" ? "↑" : "↓")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          <button
                            onClick={() => {
                              setRequestSortField("itemName");
                              setRequestSortDirection(requestSortField === "itemName" && requestSortDirection === "asc" ? "desc" : "asc");
                            }}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Item
                            {requestSortField === "itemName" && (requestSortDirection === "asc" ? "↑" : "↓")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          <button
                            onClick={() => {
                              setRequestSortField("quantity");
                              setRequestSortDirection(requestSortField === "quantity" && requestSortDirection === "asc" ? "desc" : "asc");
                            }}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Qty Requested
                            {requestSortField === "quantity" && (requestSortDirection === "asc" ? "↑" : "↓")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Availability</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Order Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          <button
                            onClick={() => {
                              setRequestSortField("requestedDate");
                              setRequestSortDirection(requestSortField === "requestedDate" && requestSortDirection === "asc" ? "desc" : "asc");
                            }}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Date Requested
                            {requestSortField === "requestedDate" && (requestSortDirection === "asc" ? "↑" : "↓")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          <button
                            onClick={() => {
                              setRequestSortField("fulfilledDate");
                              setRequestSortDirection(requestSortField === "fulfilledDate" && requestSortDirection === "asc" ? "desc" : "asc");
                            }}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Date Approved
                            {requestSortField === "fulfilledDate" && (requestSortDirection === "asc" ? "↑" : "↓")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedRequests.map((req) => {
                        const currentStock = getCurrentStock(req.itemName);
                        const recommendedAction = getRecommendedAction(req);
                        const inventoryItem = items.find((item) => item.name.toLowerCase() === req.itemName.toLowerCase());
                        return (
                          <tr key={req.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 font-mono font-semibold">
                              {req.job ? req.job.id.substring(0, 8).toUpperCase() : "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {req.user.name || req.user.email || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="font-medium">{req.itemName}</div>
                              {req.description && <div className="text-xs text-gray-500 line-clamp-1">{req.description}</div>}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {req.status === "PENDING" && canManage ? (
                                <input
                                  id={`qty-${req.id}`}
                                  type="number"
                                  defaultValue={Math.floor(req.quantity)}
                                  min="1"
                                  max="9"
                                  step="1"
                                  maxLength={1}
                                  onKeyDown={(e) => {
                                    if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                                      e.preventDefault();
                                    }
                                  }}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === "" || (value.length <= 1 && /^[1-9]$/.test(value))) {
                                      // Valid
                                    } else {
                                      e.target.value = Math.floor(req.quantity).toString();
                                    }
                                  }}
                                  onBlur={async (e) => {
                                    const numValue = Number(e.target.value);
                                    if (isNaN(numValue) || numValue < 1) {
                                      e.target.value = "1";
                                    } else if (numValue > 9) {
                                      e.target.value = "9";
                                    } else {
                                      e.target.value = Math.floor(numValue).toString();
                                    }
                                    try {
                                      const form = new FormData();
                                      form.append("status", req.status);
                                      form.append("quantity", e.target.value);
                                      const res = await updateMaterialRequest(req.id, form);
                                      if (!res.ok) {
                                        console.error("[Inventory] Quantity update error:", res.error, "requestId:", req.id, "quantity:", e.target.value);
                                        setError(res.error);
                                        e.target.value = Math.floor(req.quantity).toString();
                                      } else {
                                        loadMaterialRequests();
                                      }
                                    } catch (err: any) {
                                      console.error("[Inventory] Quantity update exception:", err, "requestId:", req.id, "quantity:", e.target.value);
                                      setError("Failed to update quantity");
                                      e.target.value = Math.floor(req.quantity).toString();
                                    }
                                  }}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                />
                              ) : (
                                <span>{Math.floor(req.quantity)} {req.unit}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {inventoryItem ? (
                                <span className={currentStock >= req.quantity ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                  {currentStock >= req.quantity ? "Available" : "Unavailable"}
                                </span>
                              ) : (
                                <span className="text-red-600 font-semibold">Unavailable</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {canManage ? (
                                <select
                                  value={req.recommendedAction || "PENDING"}
                                  onChange={async (e) => {
                                    const newValue = e.target.value;
                                    // Show confirmation for APPROVE
                                    if (newValue === "APPROVE") {
                                      const confirmed = window.confirm("Are you sure?");
                                      if (!confirmed) {
                                        e.target.value = req.recommendedAction || "PENDING";
                                        return;
                                      }
                                    }
                                    try {
                                      const form = new FormData();
                                      // Keep current status - Recommended Action is independent and does NOT change status
                                      form.append("status", req.status);
                                      form.append("recommendedAction", newValue);
                                      // Update approved date when action is set to APPROVE
                                      if (newValue === "APPROVE") {
                                        form.append("fulfilledDate", new Date().toISOString());
                                      }
                                      const res = await updateMaterialRequest(req.id, form);
                                      if (!res.ok) {
                                        console.error("[Inventory] Recommended Action update error:", res.error, "requestId:", req.id, "newValue:", newValue);
                                        setError(res.error);
                                        e.target.value = req.recommendedAction || "PENDING";
                                      } else {
                                        loadMaterialRequests();
                                      }
                                    } catch (err: any) {
                                      console.error("[Inventory] Recommended Action update exception:", err, "requestId:", req.id, "newValue:", newValue);
                                      setError("Failed to update recommended action");
                                      e.target.value = req.recommendedAction || "PENDING";
                                    }
                                  }}
                                  className={`text-xs font-medium px-2 py-1 rounded border ${
                                    (req.recommendedAction || "PENDING") === "APPROVE" ? "bg-green-100 text-green-700 border-green-300" :
                                    (req.recommendedAction || "PENDING") === "PARTIAL" ? "bg-orange-100 text-orange-700 border-orange-300" :
                                    (req.recommendedAction || "PENDING") === "REJECTED" ? "bg-red-100 text-red-700 border-red-300" :
                                    "bg-yellow-100 text-yellow-700 border-yellow-300"
                                  }`}
                                >
                                  <option value="PENDING">Pending</option>
                                  <option value="APPROVE">Approve</option>
                                  <option value="PARTIAL">Partial</option>
                                  <option value="REJECTED">Rejected</option>
                                </select>
                              ) : (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  recommendedAction === "APPROVE" ? "bg-green-100 text-green-700" :
                                  recommendedAction === "PARTIAL" ? "bg-orange-100 text-orange-700" :
                                  recommendedAction === "REJECTED" ? "bg-red-100 text-red-700" :
                                  "bg-yellow-100 text-yellow-700"
                                }`}>
                                  {recommendedAction === "APPROVE" ? "Approve" : recommendedAction === "PARTIAL" ? "Partial" : recommendedAction === "REJECTED" ? "Rejected" : "Pending"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {canManage ? (
                                <input
                                  key={`amount-${req.id}-${req.amount}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue={req.amount || ""}
                                  onBlur={async (e) => {
                                    const value = e.target.value.trim();
                                    let numValue: number | null = null;
                                    
                                    // Format and validate the value
                                    if (value === "") {
                                      numValue = null;
                                    } else {
                                      numValue = parseFloat(value);
                                      if (isNaN(numValue) || numValue < 0) {
                                        setError("Amount must be a valid number greater than or equal to 0");
                                        e.target.value = req.amount?.toString() || "";
                                        return;
                                      }
                                      // Format to 2 decimal places
                                      e.target.value = numValue.toFixed(2);
                                    }
                                    
                                    // Only save if the value actually changed
                                    if (numValue !== req.amount) {
                                      try {
                                        const form = new FormData();
                                        form.append("status", req.status);
                                        if (numValue !== null) {
                                          form.append("amount", numValue.toString());
                                        } else {
                                          form.append("amount", "");
                                        }
                                        const res = await updateMaterialRequest(req.id, form);
                                        if (!res.ok) {
                                          console.error("[Inventory] Amount update error:", res.error, "requestId:", req.id);
                                          setError(res.error);
                                          e.target.value = req.amount?.toString() || "";
                                        } else {
                                          loadMaterialRequests();
                                        }
                                      } catch (err: any) {
                                        console.error("[Inventory] Amount update exception:", err, "requestId:", req.id);
                                        setError("Failed to update amount");
                                        e.target.value = req.amount?.toString() || "";
                                      }
                                    }
                                  }}
                                  placeholder="0.00"
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-center min-h-[44px]"
                                />
                              ) : (
                                <span className="text-sm text-gray-900">
                                  {req.amount ? formatCurrency(req.amount) : "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {canManage ? (
                                <select
                                  value={req.orderStatus || ""}
                                  onChange={async (e) => {
                                    const newValue = e.target.value;
                                    // Show confirmation for RECEIVED
                                    if (newValue === "RECEIVED") {
                                      const confirmed = window.confirm("Are you sure?");
                                      if (!confirmed) {
                                        e.target.value = req.orderStatus || "";
                                        return;
                                      }
                                    }
                                    try {
                                      const form = new FormData();
                                      form.append("status", req.status);
                                      // Only append orderStatus if it's not empty
                                      if (newValue && newValue !== "") {
                                        form.append("orderStatus", newValue);
                                      } else {
                                        // Allow clearing by sending empty string
                                        form.append("orderStatus", "");
                                      }
                                      // Set dateDelivered when status is RECEIVED
                                      if (newValue === "RECEIVED") {
                                        form.append("dateDelivered", new Date().toISOString());
                                      }
                                      const res = await updateMaterialRequest(req.id, form);
                                      if (!res.ok) {
                                        console.error("[Inventory] Order Status update error:", res.error, "requestId:", req.id, "newValue:", newValue);
                                        setError(res.error);
                                        e.target.value = req.orderStatus || "";
                                      } else {
                                        loadMaterialRequests();
                                      }
                                    } catch (err: any) {
                                      console.error("[Inventory] Order Status update exception:", err, "requestId:", req.id, "newValue:", newValue);
                                      setError("Failed to update order status");
                                      e.target.value = req.orderStatus || "";
                                    }
                                  }}
                                  className="text-xs font-medium px-2 py-1 rounded border border-gray-300 bg-white"
                                >
                                  <option value="">Select...</option>
                                  <option value="TO_ORDER">To Order</option>
                                  <option value="ORDERED">Ordered</option>
                                  <option value="RECEIVED">Received</option>
                                </select>
                              ) : (
                                <span className="px-2 py-1 rounded text-xs font-medium text-gray-600">
                                  {req.orderStatus === "TO_ORDER" ? "To Order" : req.orderStatus === "ORDERED" ? "Ordered" : req.orderStatus === "RECEIVED" ? "Received" : "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(req.requestedDate)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {req.fulfilledDate ? formatDate(req.fulfilledDate) : "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                              {canManage ? (
                                <textarea
                                  id={`notes-${req.id}`}
                                  defaultValue={req.notes || ""}
                                  onBlur={async (e) => {
                                    const newNotes = e.target.value.trim();
                                    // Only update if notes changed
                                    if (newNotes !== (req.notes || "")) {
                                      try {
                                        const form = new FormData();
                                        form.append("status", req.status);
                                        form.append("notes", newNotes);
                                        const res = await updateMaterialRequest(req.id, form);
                                        if (!res.ok) {
                                          console.error("[Inventory] Notes update error:", res.error, "requestId:", req.id);
                                          setError(res.error);
                                          e.target.value = req.notes || "";
                                        } else {
                                          loadMaterialRequests();
                                        }
                                      } catch (err: any) {
                                        console.error("[Inventory] Notes update exception:", err, "requestId:", req.id);
                                        setError("Failed to update notes");
                                        e.target.value = req.notes || "";
                                      }
                                    }
                                  }}
                                  rows={2}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none"
                                  placeholder="Add notes..."
                                />
                              ) : (
                                req.notes ? (
                                  <div className="line-clamp-2" title={req.notes}>{req.notes}</div>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}

            {/* Pagination */}
            {totalRequestPages > 1 && (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-4 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {(requestCurrentPage - 1) * requestsPerPage + 1} to {Math.min(requestCurrentPage * requestsPerPage, sortedRequests.length)} of {sortedRequests.length} requests
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRequestCurrentPage(Math.max(1, requestCurrentPage - 1))}
                    disabled={requestCurrentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalRequestPages) }, (_, i) => {
                    let pageNum;
                    if (totalRequestPages <= 5) {
                      pageNum = i + 1;
                    } else if (requestCurrentPage <= 3) {
                      pageNum = i + 1;
                    } else if (requestCurrentPage >= totalRequestPages - 2) {
                      pageNum = totalRequestPages - 4 + i;
                    } else {
                      pageNum = requestCurrentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setRequestCurrentPage(pageNum)}
                        className={`px-3 py-1 border rounded-lg ${
                          requestCurrentPage === pageNum
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setRequestCurrentPage(Math.min(totalRequestPages, requestCurrentPage + 1))}
                    disabled={requestCurrentPage === totalRequestPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Material Request Submission Modal (Employees) */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit Material Request</h2>

              <form onSubmit={(e) => { e.preventDefault(); handleSubmitMaterialRequest(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee *
                  </label>
                  <input
                    type="text"
                    value={session?.user?.name || session?.user?.email || ""}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Item *
                  </label>
                  <select
                    value={requestItemName}
                    onChange={(e) => {
                      setRequestItemName(e.target.value);
                      const selectedItem = inventoryItemsForRequest.find((item) => item.name === e.target.value);
                      if (selectedItem) {
                        setRequestUnit(selectedItem.unit);
                      }
                    }}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select an item...</option>
                    {inventoryItemsForRequest.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name} ({item.quantity} {item.unit} in stock)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Qty Requested *
                    </label>
                    <input
                      type="number"
                      value={requestQuantity}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || (value.length <= 1 && /^[1-9]$/.test(value))) {
                          setRequestQuantity(value === "" ? 1 : Number(value));
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
                          setRequestQuantity(1);
                        } else if (numValue > 9) {
                          setRequestQuantity(9);
                        } else {
                          setRequestQuantity(Math.floor(numValue));
                        }
                      }}
                      min="1"
                      max="9"
                      step="1"
                      maxLength={1}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit *
                    </label>
                    <input
                      type="text"
                      value={requestUnit}
                      onChange={(e) => setRequestUnit(e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Add any additional notes or details..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestForm(false);
                      setRequestItemName("");
                      setRequestQuantity(1);
                      setRequestUnit("pcs");
                      setRequestNotes("");
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRequest}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {submittingRequest ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {editingItem ? "Edit Item" : "Add New Item"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Item Name *
                    </label>
                    <input
                      name="name"
                      type="text"
                      defaultValue={editingItem?.name}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SKU</label>
                    <input
                      name="sku"
                      type="text"
                      defaultValue={editingItem?.sku || ""}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    defaultValue={editingItem?.description || ""}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <input
                      name="category"
                      type="text"
                      defaultValue={editingItem?.category || ""}
                      list="categories"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <datalist id="categories">
                      {categories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      name="location"
                      type="text"
                      defaultValue={editingItem?.location || ""}
                      placeholder="e.g. Warehouse A, Shelf 12"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity *
                    </label>
                    <input
                      name="quantity"
                      type="number"
                      defaultValue={editingItem?.quantity ?? 0}
                      required
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
                    <input
                      name="unit"
                      type="text"
                      defaultValue={editingItem?.unit || "pcs"}
                      required
                      placeholder="pcs, kg, lbs"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Min Stock Level
                    </label>
                    <input
                      name="minStockLevel"
                      type="number"
                      defaultValue={editingItem?.minStockLevel ?? 0}
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier
                    </label>
                    <input
                      name="supplier"
                      type="text"
                      defaultValue={editingItem?.supplier || ""}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cost Per Unit ($)
                    </label>
                    <input
                      name="costPerUnit"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editingItem?.costPerUnit ?? ""}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingItem(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {editingItem ? "Update Item" : "Create Item"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Quantity Modal */}
      {showAdjustModal && adjustingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Adjust Inventory</h2>
              <p className="text-sm text-gray-600 mb-6">
                Current stock: <span className="font-bold">{adjustingItem.quantity} {adjustingItem.unit}</span>
              </p>

              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <input type="hidden" name="itemId" value={adjustingItem.id} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity Change *
                  </label>
                  <input
                    name="quantityChange"
                    type="number"
                    required
                    placeholder="Use + for add, - for remove"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Example: +50 to add 50 units, -20 to remove 20 units
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason *
                  </label>
                  <select
                    name="reason"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select a reason</option>
                    <option value="Restocked">Restocked</option>
                    <option value="Sold">Sold</option>
                    <option value="Used in Job">Used in Job</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Lost">Lost</option>
                    <option value="Returned">Returned</option>
                    <option value="Inventory Count">Inventory Count</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Additional details..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdjustModal(false);
                      setAdjustingItem(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Adjust Inventory
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && historyItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">📊 Adjustment History</h2>
                <p className="text-sm text-gray-600 mt-1">{historyItem.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryItem(null);
                  setAdjustments([]);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {loadingHistory ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading history...</p>
                </div>
              ) : adjustments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-gray-600">No adjustments recorded yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {adjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-bold ${
                                adj.quantityChange > 0
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {adj.quantityChange > 0 ? "+" : ""}
                              {adj.quantityChange} {historyItem.unit}
                            </span>
                            {adj.reason && (
                              <span className="text-sm font-medium text-gray-700">
                                {adj.reason}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            By {adj.user.name || adj.user.email} • {formatDate(adj.createdAt)}
                          </p>
                          {adj.notes && (
                            <p className="text-sm text-gray-700 mt-2">{adj.notes}</p>
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
      )}

    </main>
  );
}

