"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
import type { InventoryItem, Adjustment, MaterialRequest, InventoryItemForRequest } from "./types";
import InventoryTab from "./InventoryTab";
import MaterialsTab from "./MaterialsTab";

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
  const [itemPhotos, setItemPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustMode, setAdjustMode] = useState<"add" | "remove">("add");
  
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

  const handlePhotoUpload = useCallback(async (files: FileList) => {
    if (files.length === 0) return;

    setUploadingPhotos(true);
    setError(undefined);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload photos");
      }

      const data = await response.json();
      if (data.success && data.paths) {
        setItemPhotos((prev) => [...prev, ...data.paths]);
        setSuccess(`${data.paths.length} photo(s) uploaded successfully`);
      } else {
        throw new Error("Invalid response from upload server");
      }
    } catch (err: any) {
      console.error("Photo upload error:", err);
      setError(err?.message || "Failed to upload photos");
    } finally {
      setUploadingPhotos(false);
    }
  }, []);

  const handleRemovePhoto = useCallback((index: number) => {
    setItemPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const formData = new FormData(e.currentTarget);
    
    // Add photos as JSON string
    if (itemPhotos.length > 0) {
      formData.append("photos", JSON.stringify(itemPhotos));
    }

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
    setItemPhotos([]);
    loadData();
  }, [editingItem, loadData, itemPhotos]);

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

    // Normalize quantity based on mode (add/remove) so mobile users don't need to type "-".
    const raw = formData.get("quantityChange")?.toString().replace(/,/g, ".").trim() || "";
    const numeric = parseFloat(raw);
    if (Number.isNaN(numeric)) {
      setError("Enter a valid quantity (numbers only).");
      return;
    }
    const signed = adjustMode === "remove" ? -Math.abs(numeric) : Math.abs(numeric);
    formData.set("quantityChange", signed.toString());

    const res = await adjustInventory(formData);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSuccess(`Inventory adjusted! New quantity: ${res.item?.quantity} ${res.item?.unit}`);
    setShowAdjustModal(false);
    setAdjustingItem(null);
    loadData();
  }, [loadData, adjustMode]);

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
    setAdjustMode("add");
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
    if (item.quantity === 0) return { text: "OUT OF STOCK", color: "bg-red-100 text-red-800", icon: "🚨" };
    if (item.quantity <= item.minStockLevel) return { text: "LOW STOCK", color: "bg-orange-100 text-orange-800", icon: "⚠️" };
    return { text: "IN STOCK", color: "bg-green-100 text-green-800", icon: "✓" };
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
      const availability = inventoryItem ? (currentStock >= req.quantity ? "AVAILABLE" : "UNAVAILABLE") : "UNAVAILABLE";
      const dateApproved = req.fulfilledDate ? formatDate(req.fulfilledDate) : "";
      const orderStatus = req.orderStatus === "TO_ORDER" ? "TO ORDER" : req.orderStatus === "ORDERED" ? "ORDERED" : req.orderStatus === "RECEIVED" ? "RECEIVED" : "";
      return [
        req.job ? req.job.id.substring(0, 8).toUpperCase() : "",
        req.user.name || req.user.email || "",
        req.itemName,
        `${req.quantity} ${req.unit}`,
        availability,
        recommendedAction === "APPROVE" ? "APPROVE" : recommendedAction === "PARTIAL" ? "PARTIAL" : recommendedAction === "REJECTED" ? "REJECTED" : "PENDING",
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

  // Early return for loading
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
      <header className="bg-black border-b-2 border-[#001f3f] shadow-lg sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">📦 Inventory Management</h1>
            <p className="text-xs sm:text-sm text-gray-300">Track and manage your inventory items</p>
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
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
            <button
              onClick={() => setError(undefined)}
              className="float-right text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {success}
            <button
              onClick={() => setSuccess(undefined)}
              className="float-right text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Stock Alerts - Only show on Inventory tab */}
        {activeTab === "inventory" && (lowStockCount > 0 || outOfStockCount > 0) && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {outOfStockCount > 0 && (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
                <p className="font-semibold text-red-900 text-base uppercase tracking-wide">OUT OF STOCK</p>
                <p className="text-sm text-red-700 mt-1">{outOfStockCount} item(s) need restocking</p>
              </div>
            )}
            {lowStockCount > 0 && (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
                <p className="font-semibold text-orange-900 text-base uppercase tracking-wide">LOW STOCK WARNING</p>
                <p className="text-sm text-orange-700 mt-1">{lowStockCount} item(s) running low</p>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
              <button
                onClick={() => {
                  setActiveTab("inventory");
                  setCurrentPage(1);
                }}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap min-h-[44px] flex items-center ${
                  activeTab === "inventory"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                📦 <span className="ml-1 sm:ml-0">Inventory</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("materials");
                  setRequestCurrentPage(1);
                  if (materialRequests.length === 0) {
                    loadMaterialRequests();
                  }
                }}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap min-h-[44px] flex items-center ${
                  activeTab === "materials"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                📋 <span className="ml-1 sm:ml-0">Materials Requested</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Inventory Tab Content */}
        {activeTab === "inventory" && (
          <InventoryTab
            loading={loading}
            items={items}
            sortedItems={sortedItems}
            paginatedItems={paginatedItems}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            filterStockStatus={filterStockStatus}
            setFilterStockStatus={setFilterStockStatus}
            sortField={sortField}
            sortDirection={sortDirection}
            setSortField={setSortField}
            setSortDirection={setSortDirection}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalInventoryPages={totalInventoryPages}
            itemsPerPage={itemsPerPage}
            categories={categories}
            canManage={canManage}
            isAdmin={isAdmin}
            getStockStatus={getStockStatus}
            formatDate={formatDate}
            exportInventoryToCSV={exportInventoryToCSV}
            openCreateModal={openCreateModal}
            openHistoryModal={openHistoryModal}
            openAdjustModal={openAdjustModal}
            openEditModal={openEditModal}
            handleDelete={handleDelete}
          />
        )}

        {/* Materials Requested Tab Content */}
        {activeTab === "materials" && (
          <MaterialsTab
            loadingRequests={loadingRequests}
            materialRequests={materialRequests}
            sortedRequests={sortedRequests}
            paginatedRequests={paginatedRequests}
            requestSearchTerm={requestSearchTerm}
            setRequestSearchTerm={setRequestSearchTerm}
            filterRequester={filterRequester}
            setFilterRequester={setFilterRequester}
            filterItem={filterItem}
            setFilterItem={setFilterItem}
            filterAction={filterAction}
            setFilterAction={setFilterAction}
            filterRequestStatus={filterRequestStatus}
            setFilterRequestStatus={setFilterRequestStatus}
            requestSortField={requestSortField}
            requestSortDirection={requestSortDirection}
            setRequestSortField={setRequestSortField}
            setRequestSortDirection={setRequestSortDirection}
            requestCurrentPage={requestCurrentPage}
            setRequestCurrentPage={setRequestCurrentPage}
            totalRequestPages={totalRequestPages}
            requestsPerPage={requestsPerPage}
            uniqueItems={uniqueItems}
            userRole={userRole}
            canManage={canManage}
            items={items}
            getCurrentStock={getCurrentStock}
            getRecommendedAction={getRecommendedAction}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            exportRequestsToCSV={exportRequestsToCSV}
            setShowRequestForm={setShowRequestForm}
            loadMaterialRequests={loadMaterialRequests}
            setError={setError}
          />
        )}
      </div>

      {/* Material Request Submission Modal (Employees) */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto modal-enter">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Submit Material Request</h2>
                <button
                  onClick={() => {
                    setShowRequestForm(false);
                    setRequestItemName("");
                    setRequestQuantity(1);
                    setRequestUnit("pcs");
                    setRequestNotes("");
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-110 active:scale-95"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSubmitMaterialRequest(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee *
                  </label>
                  <input
                    type="text"
                    value={session?.user?.name || session?.user?.email || ""}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-600 min-h-[44px] transition-all duration-200"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 hover:shadow-sm active:scale-95 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRequest}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:shadow-md active:scale-95 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto modal-enter">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingItem ? "Edit Item" : "Add New Item"}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingItem(null);
                    setItemPhotos([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-110 active:scale-95"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Photos Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="font-semibold">Photos</span>
                    <span className="text-xs text-gray-500 ml-2">(Upload one or more photos showing: what the item is, current condition, identifying marks or variations)</span>
                  </label>
                  
                  {/* Photo Upload */}
                  <div className="mb-3">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {uploadingPhotos ? (
                          <>
                            <svg className="w-8 h-8 mb-2 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-sm text-gray-500">Uploading...</p>
                          </>
                        ) : (
                          <>
                            <svg className="w-8 h-8 mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <p className="text-sm text-gray-500">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB each</p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        multiple
                        disabled={uploadingPhotos}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handlePhotoUpload(e.target.files);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Photo Gallery */}
                  {itemPhotos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
                      {itemPhotos.map((photoUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={photoUrl}
                            alt={`Item photo ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove photo"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SKU</label>
                    <input
                      name="sku"
                      type="text"
                      defaultValue={editingItem?.sku || ""}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="font-semibold">Clear Text Description *</span>
                    <span className="text-xs text-gray-500 ml-2">(Describe what the item is, its purpose, and key characteristics)</span>
                  </label>
                  <textarea
                    name="description"
                    defaultValue={editingItem?.description || ""}
                    rows={4}
                    required
                    placeholder="Provide a clear, detailed description of the item. Include what it is, its purpose, dimensions, materials, or any other relevant details that help identify and understand the item."
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-base"
                  />
                </div>

                {/* Photos Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="font-semibold">Photos</span>
                    <span className="text-xs text-gray-500 ml-2">(Upload one or more photos showing: what the item is, current condition, identifying marks or variations)</span>
                  </label>
                  
                  {/* Photo Upload */}
                  <div className="mb-3">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {uploadingPhotos ? (
                          <>
                            <svg className="w-8 h-8 mb-2 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-sm text-gray-500">Uploading...</p>
                          </>
                        ) : (
                          <>
                            <svg className="w-8 h-8 mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <p className="text-sm text-gray-500">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB each</p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        multiple
                        disabled={uploadingPhotos}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handlePhotoUpload(e.target.files);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Photo Gallery */}
                  {itemPhotos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
                      {itemPhotos.map((photoUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={photoUrl}
                            alt={`Item photo ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove photo"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <input
                      name="category"
                      type="text"
                      defaultValue={editingItem?.category || ""}
                      list="categories"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier
                    </label>
                    <input
                      name="supplier"
                      type="text"
                      defaultValue={editingItem?.supplier || ""}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingItem(null);
                      setItemPhotos([]);
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 hover:shadow-sm active:scale-95 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:shadow-md active:scale-95 font-medium"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto modal-enter">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Adjust Inventory</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Current stock: <span className="font-bold">{adjustingItem.quantity} {adjustingItem.unit}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAdjustModal(false);
                    setAdjustingItem(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-110 active:scale-95"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <input type="hidden" name="itemId" value={adjustingItem.id} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity Change *
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setAdjustMode("add")}
                      className={`flex-1 px-3 py-2 rounded-lg border ${
                        adjustMode === "add"
                          ? "bg-blue-50 border-blue-500 text-blue-800 font-semibold"
                          : "bg-white border-gray-300 text-gray-700"
                      }`}
                    >
                      Add (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustMode("remove")}
                      className={`flex-1 px-3 py-2 rounded-lg border ${
                        adjustMode === "remove"
                          ? "bg-red-50 border-red-500 text-red-800 font-semibold"
                          : "bg-white border-gray-300 text-gray-700"
                      }`}
                    >
                      Remove (–)
                    </button>
                  </div>
                  <input
                    name="quantityChange"
                    type="text"
                    inputMode="decimal"
                    pattern="^-?[0-9]*[.,]?[0-9]*$"
                    required
                    placeholder="Enter amount (we'll apply + or –)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1 break-words">
                    Enter the amount; tap Add/Remove above and we’ll set the sign for you.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason *
                  </label>
                  <select
                    name="reason"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdjustModal(false);
                      setAdjustingItem(null);
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 hover:shadow-sm active:scale-95 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:shadow-md active:scale-95 font-medium"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto modal-enter">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center z-[1]">
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
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Item Details Section */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-2">Item Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600"><strong>Name:</strong> {historyItem.name}</p>
                    {historyItem.sku && <p className="text-sm text-gray-600"><strong>SKU:</strong> {historyItem.sku}</p>}
                    {historyItem.description && (
                      <p className="text-sm text-gray-600 mt-2"><strong>Description:</strong> {historyItem.description}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600"><strong>Current Quantity:</strong> {historyItem.quantity} {historyItem.unit}</p>
                    {historyItem.location && <p className="text-sm text-gray-600"><strong>Location:</strong> {historyItem.location}</p>}
                  </div>
                </div>
                
                {/* Photos Display */}
                {historyItem.photos && historyItem.photos.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Photos ({historyItem.photos.length})</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {historyItem.photos.map((photoUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={photoUrl}
                            alt={`${historyItem.name} photo ${index + 1}`}
                            className="w-full h-24 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              const modal = document.createElement('div');
                              modal.className = 'fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4';
                              const img = document.createElement('img');
                              img.src = photoUrl;
                              img.alt = `${historyItem.name} photo ${index + 1}`;
                              img.className = 'max-w-full max-h-[90vh] object-contain rounded-lg';
                              const closeBtn = document.createElement('button');
                              closeBtn.className = 'absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-2';
                              closeBtn.innerHTML = '×';
                              closeBtn.onclick = () => modal.remove();
                              modal.appendChild(closeBtn);
                              modal.appendChild(img);
                              modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
                              document.body.appendChild(modal);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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

