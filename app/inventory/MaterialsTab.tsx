"use client";

import { updateMaterialRequest } from "../material-requests/actions";
import type { MaterialRequest, InventoryItem } from "./types";

interface MaterialsTabProps {
  loadingRequests: boolean;
  materialRequests: MaterialRequest[];
  sortedRequests: MaterialRequest[];
  paginatedRequests: MaterialRequest[];
  requestSearchTerm: string;
  setRequestSearchTerm: (value: string) => void;
  filterRequester: string;
  setFilterRequester: (value: string) => void;
  filterItem: string;
  setFilterItem: (value: string) => void;
  filterAction: string;
  setFilterAction: (value: string) => void;
  filterRequestStatus: string;
  setFilterRequestStatus: (value: string) => void;
  requestSortField: "requestNumber" | "requestedDate" | "itemName" | "quantity" | "fulfilledDate";
  requestSortDirection: "asc" | "desc";
  setRequestSortField: (field: "requestNumber" | "requestedDate" | "itemName" | "quantity" | "fulfilledDate") => void;
  setRequestSortDirection: (dir: "asc" | "desc") => void;
  requestCurrentPage: number;
  setRequestCurrentPage: (page: number) => void;
  totalRequestPages: number;
  requestsPerPage: number;
  uniqueItems: string[];
  userRole: string;
  canManage: boolean;
  items: InventoryItem[];
  getCurrentStock: (itemName: string) => number;
  getRecommendedAction: (req: MaterialRequest) => string;
  formatDate: (dateString: string) => string;
  formatCurrency: (amount: number | null) => string;
  exportRequestsToCSV: () => void;
  setShowRequestForm: (show: boolean) => void;
  loadMaterialRequests: () => void;
  setError: (error: string | undefined) => void;
}

export default function MaterialsTab({
  loadingRequests,
  materialRequests,
  sortedRequests,
  paginatedRequests,
  requestSearchTerm,
  setRequestSearchTerm,
  filterRequester,
  setFilterRequester,
  filterItem,
  setFilterItem,
  filterAction,
  setFilterAction,
  filterRequestStatus,
  setFilterRequestStatus,
  requestSortField,
  requestSortDirection,
  setRequestSortField,
  setRequestSortDirection,
  requestCurrentPage,
  setRequestCurrentPage,
  totalRequestPages,
  requestsPerPage,
  uniqueItems,
  userRole,
  canManage,
  items,
  getCurrentStock,
  getRecommendedAction,
  formatDate,
  formatCurrency,
  exportRequestsToCSV,
  setShowRequestForm,
  loadMaterialRequests,
  setError,
}: MaterialsTabProps) {
  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 sm:p-6">
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
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm min-h-[44px]"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {userRole === "EMPLOYEE" && (
              <button
                onClick={() => setShowRequestForm(true)}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap min-h-[44px] min-w-[44px]"
              >
                + Submit Request
              </button>
            )}
            <button
              onClick={exportRequestsToCSV}
              className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium min-h-[44px] min-w-[44px]"
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Employee Filter */}
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

          {/* Item Filter */}
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

          {/* Action Filter */}
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
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job No.</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500">Availability</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500">Amount</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500">Order Status</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedRequests.map((req) => {
                  const currentStock = getCurrentStock(req.itemName);
                  const recommendedAction = getRecommendedAction(req);
                  const inventoryItem = items.find((item) => item.name.toLowerCase() === req.itemName.toLowerCase());
                  return (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-2 sm:px-4 py-3 text-sm text-gray-900 font-mono font-semibold min-w-[80px] sm:min-w-0">
                        {req.job ? req.job.id.substring(0, 8).toUpperCase() : "—"}
                      </td>
                      <td className="px-2 sm:px-4 py-3 text-sm text-gray-700 min-w-[100px] sm:min-w-0">
                        <div className="break-words">{req.user.name || req.user.email || "—"}</div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 text-sm text-gray-900 min-w-[120px] sm:min-w-0">
                        <div className="font-medium break-words">{req.itemName}</div>
                        {req.description && <div className="text-xs text-gray-500 line-clamp-1 break-words" title={req.description}>{req.description}</div>}
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
                              if (newValue === "APPROVE") {
                                const confirmed = window.confirm("Are you sure?");
                                if (!confirmed) {
                                  e.target.value = req.recommendedAction || "PENDING";
                                  return;
                                }
                              }
                              try {
                                const form = new FormData();
                                form.append("status", req.status);
                                form.append("recommendedAction", newValue);
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
                              
                              if (value === "") {
                                numValue = null;
                              } else {
                                numValue = parseFloat(value);
                                if (isNaN(numValue) || numValue < 0) {
                                  setError("Amount must be a valid number greater than or equal to 0");
                                  e.target.value = req.amount?.toString() || "";
                                  return;
                                }
                                e.target.value = numValue.toFixed(2);
                              }
                              
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
                                if (newValue && newValue !== "") {
                                  form.append("orderStatus", newValue);
                                } else {
                                  form.append("orderStatus", "");
                                }
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
                      <td className="px-2 sm:px-4 py-3 text-sm text-gray-600 max-w-[200px] sm:max-w-xs">
                        {canManage ? (
                          <textarea
                            id={`notes-${req.id}`}
                            defaultValue={req.notes || ""}
                            onBlur={async (e) => {
                              const newNotes = e.target.value.trim();
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
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none min-h-[44px]"
                            placeholder="Add notes..."
                          />
                        ) : (
                          req.notes ? (
                            <div className="line-clamp-2 break-words" title={req.notes}>{req.notes}</div>
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
      )}

      {/* Pagination */}
      {totalRequestPages > 1 && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left break-words">
            Showing {(requestCurrentPage - 1) * requestsPerPage + 1} to {Math.min(requestCurrentPage * requestsPerPage, sortedRequests.length)} of {sortedRequests.length} requests
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              onClick={() => setRequestCurrentPage(Math.max(1, requestCurrentPage - 1))}
              disabled={requestCurrentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">←</span>
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
                  className={`px-3 py-2 border rounded-lg min-h-[44px] min-w-[44px] ${
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
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

