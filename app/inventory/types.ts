export interface InventoryItem {
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

export interface Adjustment {
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

export interface MaterialRequest {
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

export interface InventoryItemForRequest {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minStockLevel: number;
}

