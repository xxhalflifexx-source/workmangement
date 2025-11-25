"use client";

import { useEffect, useState } from "react";
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustInventory,
  getItemAdjustments,
} from "./actions";
import { getMaterialRequests, updateMaterialRequest } from "../material-requests/actions";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDateTime, nowInCentral, centralToUTC } from "@/lib/date-utils";

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
  itemName: string;
  quantity: number;
  unit: string;
  description: string | null;
  priority: string;
  status: string;
  requestedDate: string;
  fulfilledDate: string | null;
  notes: string | null;
  job: {
    id: string;
    title: string;
  } | null;
  user: {
    name: string | null;
    email: string | null;
  };
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

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStockStatus, setFilterStockStatus] = useState("ALL");
  
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [filterRequestStatus, setFilterRequestStatus] = useState("PENDING");

  useEffect(() => {
    loadData();
    if (canManage) {
      loadMaterialRequests();
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(undefined);
    setSuccess(undefined);

    const res = await getInventoryItems();

    if (res.ok) {
      setItems(res.items as any);
    } else {
      setError(res.error);
    }

    setLoading(false);
  };

  const loadMaterialRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await getMaterialRequests();
      if (res.ok) {
        setMaterialRequests(res.requests as any);
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError("Failed to load material requests");
    }
    setLoadingRequests(false);
  };

  const handleUpdateRequestStatus = async (requestId: string, status: string) => {
    setError(undefined);
    const formData = new FormData();
    formData.append("status", status);
    const res = await updateMaterialRequest(requestId, formData);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Update local state
    setMaterialRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status, fulfilledDate: status === "FULFILLED" ? centralToUTC(nowInCentral().toDate()).toISOString() : r.fulfilledDate } : r)));
    setSuccess(`Request ${status.toLowerCase()} successfully`);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item? This will also delete all adjustment history.")) return;

    const res = await deleteInventoryItem(itemId);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSuccess("Item deleted successfully!");
    loadData();
  };

  const handleAdjustSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const openAdjustModal = (item: InventoryItem) => {
    setAdjustingItem(item);
    setShowAdjustModal(true);
  };

  const openHistoryModal = async (item: InventoryItem) => {
    setHistoryItem(item);
    setShowHistoryModal(true);
    setLoadingHistory(true);

    const res = await getItemAdjustments(item.id);
    if (res.ok) {
      setAdjustments(res.adjustments as any);
    }
    setLoadingHistory(false);
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) return { text: "Out of Stock", color: "bg-red-100 text-red-800", icon: "🚨" };
    if (item.quantity <= item.minStockLevel) return { text: "Low Stock", color: "bg-orange-100 text-orange-800", icon: "⚠️" };
    return { text: "In Stock", color: "bg-green-100 text-green-800", icon: "✓" };
  };

  const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean))) as string[];

  const filteredItems = items.filter((item) => {
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

  const lowStockCount = items.filter((item) => item.quantity > 0 && item.quantity <= item.minStockLevel).length;
  const outOfStockCount = items.filter((item) => item.quantity === 0).length;

  const formatDate = (dateString: string) => {
    return formatDateTime(dateString);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-24 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-sm text-gray-500">Track and manage your inventory items</p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-full mx-auto px-24 py-8">
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

        {/* Stock Alerts */}
        {(lowStockCount > 0 || outOfStockCount > 0) && (
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

        {/* Controls */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex-1 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search by name, SKU, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
              />
            </div>

            {canManage && (
              <button
                onClick={openCreateModal}
                className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
              >
                + Add Item
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
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
              onChange={(e) => setFilterStockStatus(e.target.value)}
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
        ) : filteredItems.length === 0 ? (
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => {
                    const stockStatus = getStockStatus(item);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-start">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.name}</div>
                              {item.sku && (
                                <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                              )}
                              {item.description && (
                                <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {item.category ? (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              {item.category}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900">
                            {item.quantity} {item.unit}
                          </div>
                          {item.minStockLevel > 0 && (
                            <div className="text-xs text-gray-500">Min: {item.minStockLevel}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.location || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${stockStatus.color}`}
                          >
                            {stockStatus.icon} {stockStatus.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
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
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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

      {/* Material Requests (Managers/Admins) */}
      {canManage && (
        <div className="bg-white rounded-xl shadow border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Material Requests</h2>
              <p className="text-sm text-gray-500">View and manage all job material requests</p>
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-sm text-gray-600">Filter:</label>
              <select
                value={filterRequestStatus}
                onChange={(e) => setFilterRequestStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="REJECTED">Rejected</option>
                <option value="FULFILLED">Fulfilled</option>
              </select>
              <button onClick={loadMaterialRequests} className="text-sm px-3 py-2 border rounded-lg hover:bg-gray-50">Refresh</button>
            </div>
          </div>

          {loadingRequests ? (
            <div className="p-6 text-center text-gray-600">Loading requests...</div>
          ) : (
            <div className="p-4 overflow-x-auto">
              {(() => {
                const filtered = materialRequests.filter((r) => filterRequestStatus === "ALL" ? true : r.status === filterRequestStatus);
                if (filtered.length === 0) {
                  return <div className="text-center text-gray-500 py-8">No material requests</div>;
                }
                return (
                  <table className="min-w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtered.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">{formatDateTime(req.requestedDate)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="font-medium">{req.itemName}</div>
                            {req.description && <div className="text-xs text-gray-500 line-clamp-1">{req.description}</div>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {req.status === "PENDING" ? (
                              <input
                                id={`qty-${req.id}`}
                                type="number"
                                defaultValue={Math.floor(req.quantity)}
                                min="1"
                                max="9"
                                step="1"
                                maxLength={1}
                                onKeyDown={(e) => {
                                  // Prevent decimal point, minus sign, and 'e' (scientific notation)
                                  if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                                    e.preventDefault();
                                  }
                                }}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Only allow single digit numbers (1-9), no decimals
                                  if (value === "" || (value.length <= 1 && /^[1-9]$/.test(value))) {
                                    // Value is valid, allow it
                                  } else {
                                    // If user tries to enter more than one digit or decimal, keep current value
                                    e.target.value = Math.floor(req.quantity).toString();
                                  }
                                }}
                                onBlur={(e) => {
                                  // Ensure value is a whole number between 1-9 on blur
                                  const numValue = Number(e.target.value);
                                  if (isNaN(numValue) || numValue < 1) {
                                    e.target.value = "1";
                                  } else if (numValue > 9) {
                                    e.target.value = "9";
                                  } else {
                                    e.target.value = Math.floor(numValue).toString(); // Ensure whole number, no decimals
                                  }
                                  // Auto-save quantity change
                                  const form = new FormData();
                                  form.append("status", req.status);
                                  form.append("quantity", e.target.value);
                                  updateMaterialRequest(req.id, form).then((res) => {
                                    if (!res.ok) {
                                      setError(res.error);
                                      // Revert to original value on error
                                      e.target.value = Math.floor(req.quantity).toString();
                                    } else {
                                      loadMaterialRequests();
                                    }
                                  });
                                }}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                              />
                            ) : (
                              <span>{Math.floor(req.quantity)} {req.unit}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-blue-700">{req.job ? req.job.title : "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{req.user.name || req.user.email}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${req.priority === "URGENT" ? "bg-red-100 text-red-700" : req.priority === "HIGH" ? "bg-orange-100 text-orange-700" : req.priority === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                              {req.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${req.status === "FULFILLED" ? "bg-green-100 text-green-700" : req.status === "APPROVED" ? "bg-blue-100 text-blue-700" : req.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {req.status === "PENDING" && (
                              <div className="inline-flex gap-2 items-center">
                                <input id={`amt-${req.id}`} type="number" step="0.01" placeholder="Amount" className="w-28 px-2 py-1 border rounded text-sm" />
                                <button onClick={() => {
                                  const input = document.getElementById(`amt-${req.id}`) as HTMLInputElement | null;
                                  const val = input?.value || "";
                                  const form = new FormData();
                                  form.append("status", "APPROVED");
                                  if (val) form.append("amount", val);
                                  updateMaterialRequest(req.id, form).then((res) => {
                                    if (!res.ok) { setError(res.error); return; }
                                    // refresh inline
                                    loadMaterialRequests();
                                    setSuccess("Request approved");
                                  });
                                }} className="px-3 py-1 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50">Approve</button>
                                <button onClick={() => handleUpdateRequestStatus(req.id, "REJECTED")} className="px-3 py-1 border border-red-300 text-red-700 rounded-lg hover:bg-red-50">Reject</button>
                                <button onClick={() => handleUpdateRequestStatus(req.id, "ON_HOLD")} className="px-3 py-1 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">On Hold</button>
                              </div>
                            )}
                            {req.status === "ON_HOLD" && (
                              <div className="inline-flex gap-2 items-center">
                                <button onClick={() => handleUpdateRequestStatus(req.id, "PENDING")} className="px-3 py-1 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Resume</button>
                                <button onClick={() => handleUpdateRequestStatus(req.id, "REJECTED")} className="px-3 py-1 border border-red-300 text-red-700 rounded-lg hover:bg-red-50">Reject</button>
                              </div>
                            )}
                            {req.status === "APPROVED" && (
                              <button onClick={() => handleUpdateRequestStatus(req.id, "FULFILLED")} className="px-3 py-1 border border-green-300 text-green-700 rounded-lg hover:bg-green-50">Mark Fulfilled</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

