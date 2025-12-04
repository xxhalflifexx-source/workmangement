"use client";

import type { InventoryItem } from "./types";

interface InventoryTabProps {
  loading: boolean;
  items: InventoryItem[];
  sortedItems: InventoryItem[];
  paginatedItems: InventoryItem[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterCategory: string;
  setFilterCategory: (value: string) => void;
  filterStockStatus: string;
  setFilterStockStatus: (value: string) => void;
  sortField: "name" | "quantity" | "location" | "updatedAt";
  sortDirection: "asc" | "desc";
  setSortField: (field: "name" | "quantity" | "location" | "updatedAt") => void;
  setSortDirection: (dir: "asc" | "desc") => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalInventoryPages: number;
  itemsPerPage: number;
  categories: string[];
  canManage: boolean;
  isAdmin: boolean;
  getStockStatus: (item: InventoryItem) => { text: string; color: string; icon: string };
  formatDate: (dateString: string) => string;
  exportInventoryToCSV: () => void;
  openCreateModal: () => void;
  openHistoryModal: (item: InventoryItem) => void;
  openAdjustModal: (item: InventoryItem) => void;
  openEditModal: (item: InventoryItem) => void;
  handleDelete: (itemId: string) => void;
}

export default function InventoryTab({
  loading,
  items,
  sortedItems,
  paginatedItems,
  searchTerm,
  setSearchTerm,
  filterCategory,
  setFilterCategory,
  filterStockStatus,
  setFilterStockStatus,
  sortField,
  sortDirection,
  setSortField,
  setSortDirection,
  currentPage,
  setCurrentPage,
  totalInventoryPages,
  itemsPerPage,
  categories,
  canManage,
  isAdmin,
  getStockStatus,
  formatDate,
  exportInventoryToCSV,
  openCreateModal,
  openHistoryModal,
  openAdjustModal,
  openEditModal,
  handleDelete,
}: InventoryTabProps) {
  return (
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
                            <div className="text-xs text-gray-500 line-clamp-1 break-words" title={item.description}>
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
  );
}

