"use client";

import { useState } from "react";
import type { InventoryItem } from "./types";
import PhotoViewerModal from "../qc/PhotoViewerModal";

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
  const [viewingPhotos, setViewingPhotos] = useState<string[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const openPhotoViewer = (photos: string[], index: number = 0) => {
    setViewingPhotos(photos);
    setPhotoIndex(index);
    setShowPhotoViewer(true);
  };

  return (
    <>
      {showPhotoViewer && viewingPhotos.length > 0 && (
        <PhotoViewerModal
          photos={viewingPhotos}
          initialIndex={photoIndex}
          onClose={() => {
            setShowPhotoViewer(false);
            setViewingPhotos([]);
            setPhotoIndex(0);
          }}
        />
      )}
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Inventory</h2>
        <div className="flex gap-2">
          <button
            onClick={exportInventoryToCSV}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium min-h-[44px]"
          >
            Export CSV
          </button>
          {canManage && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium min-h-[44px]"
            >
              + Add Item
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Name, SKU, or description..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock Status
            </label>
            <select
              value={filterStockStatus}
              onChange={(e) => {
                setFilterStockStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ALL">All Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW">Low/Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inventory...</p>
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-12 text-center">
          <p className="text-lg font-medium text-gray-900 mb-2">
            {items.length === 0 ? "No inventory items yet" : "No items match your search"}
          </p>
          <p className="text-sm text-gray-600">
            {items.length === 0
              ? canManage
                ? "Add your first inventory item to get started"
                : "No items in inventory yet"
              : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-indigo-600 to-blue-600">
                  <tr>
                    <th
                      className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-indigo-700 transition-colors"
                      onClick={() => {
                        setSortField("name");
                        setSortDirection(sortField === "name" && sortDirection === "asc" ? "desc" : "asc");
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Item Name
                        {sortField === "name" && (
                          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Category
                    </th>
                    <th
                      className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-indigo-700 transition-colors"
                      onClick={() => {
                        setSortField("quantity");
                        setSortDirection(sortField === "quantity" && sortDirection === "asc" ? "desc" : "asc");
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Quantity
                        {sortField === "quantity" && (
                          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Unit
                    </th>
                    <th
                      className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-indigo-700 transition-colors"
                      onClick={() => {
                        setSortField("location");
                        setSortDirection(sortField === "location" && sortDirection === "asc" ? "desc" : "asc");
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Location
                        {sortField === "location" && (
                          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th
                      className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-indigo-700 transition-colors"
                      onClick={() => {
                        setSortField("updatedAt");
                        setSortDirection(sortField === "updatedAt" && sortDirection === "asc" ? "desc" : "asc");
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Last Updated
                        {sortField === "updatedAt" && (
                          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedItems.map((item) => {
                    const stockStatus = getStockStatus(item);
                    return (
                          <tr key={item.id} className="hover:bg-indigo-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          <div className="flex items-center gap-3">
                            {/* Photo Thumbnail */}
                            {item.photos && item.photos.length > 0 && (
                              <div className="flex-shrink-0 relative">
                                <img
                                  src={item.photos[0]}
                                  alt={item.name}
                                  className="w-12 h-12 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => openPhotoViewer(item.photos || [], 0)}
                                />
                                {item.photos.length > 1 && (
                                  <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                                    +{item.photos.length - 1}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{item.name}</div>
                              {item.sku && (
                                <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                              )}
                              {item.description && (
                                <div className="text-xs text-gray-600 mt-1 line-clamp-2">{item.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.category || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {Math.floor(item.quantity)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.location || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`}
                          >
                            <span>{stockStatus.icon}</span>
                            <span>{stockStatus.text}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(item.updatedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openHistoryModal(item)}
                              className="px-3 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                              title="View history"
                            >
                              View
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={() => openAdjustModal(item)}
                                  className="px-3 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                                  title="Adjust quantity"
                                >
                                  Adjust
                                </button>
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="px-3 py-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                                >
                                  Edit
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                    className="px-3 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-all duration-200 text-xs font-medium min-h-[44px]"
                                  >
                                    Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
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
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left break-words">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedItems.length)} of {sortedItems.length} items
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">←</span>
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
                  className={`px-3 py-2 border rounded-lg min-h-[44px] min-w-[44px] ${
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
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

