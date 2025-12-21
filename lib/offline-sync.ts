/**
 * Offline sync functionality for Capacitor
 * Stores data locally when offline and syncs when online
 */

import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { isNativeApp } from './camera-native';

const SYNC_QUEUE_KEY = 'offline_sync_queue';
const PENDING_RECEIPTS_KEY = 'pending_receipts';
const PENDING_EXPENSES_KEY = 'pending_expenses';

export interface PendingReceipt {
  id: string;
  jobId: string;
  userId: string;
  amount: number;
  receiptUrl: string;
  storeName?: string;
  timestamp: number;
}

export interface PendingExpense {
  id: string;
  jobId: string;
  userId: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  timestamp: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'receipt' | 'expense' | 'learning';
  data: any;
  timestamp: number;
  retries: number;
}

/**
 * Check if device is online
 */
export async function isOnline(): Promise<boolean> {
  if (!isNativeApp()) {
    return navigator.onLine;
  }

  try {
    const status = await Network.getStatus();
    return status.connected;
  } catch (error) {
    console.error('[OfflineSync] Failed to check network status:', error);
    return false;
  }

}

/**
 * Get sync queue from storage
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const { value } = await Preferences.get({ key: SYNC_QUEUE_KEY });
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.error('[OfflineSync] Failed to get sync queue:', error);
    return [];
  }
}

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
  try {
    const queue = await getSyncQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(newItem);
    await Preferences.set({ key: SYNC_QUEUE_KEY, value: JSON.stringify(queue) });
  } catch (error) {
    console.error('[OfflineSync] Failed to add to sync queue:', error);
  }
}

/**
 * Remove item from sync queue
 */
export async function removeFromSyncQueue(itemId: string): Promise<void> {
  try {
    const queue = await getSyncQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    await Preferences.set({ key: SYNC_QUEUE_KEY, value: JSON.stringify(filtered) });
  } catch (error) {
    console.error('[OfflineSync] Failed to remove from sync queue:', error);
  }
}

/**
 * Store pending receipt locally
 */
export async function storePendingReceipt(receipt: PendingReceipt): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: PENDING_RECEIPTS_KEY });
    const receipts: PendingReceipt[] = value ? JSON.parse(value) : [];
    receipts.push(receipt);
    await Preferences.set({ key: PENDING_RECEIPTS_KEY, value: JSON.stringify(receipts) });
    
    // Add to sync queue
    await addToSyncQueue({
      type: 'receipt',
      data: receipt,
    });
  } catch (error) {
    console.error('[OfflineSync] Failed to store pending receipt:', error);
  }
}

/**
 * Get pending receipts
 */
export async function getPendingReceipts(): Promise<PendingReceipt[]> {
  try {
    const { value } = await Preferences.get({ key: PENDING_RECEIPTS_KEY });
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.error('[OfflineSync] Failed to get pending receipts:', error);
    return [];
  }
}

/**
 * Store pending expense locally
 */
export async function storePendingExpense(expense: PendingExpense): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: PENDING_EXPENSES_KEY });
    const expenses: PendingExpense[] = value ? JSON.parse(value) : [];
    expenses.push(expense);
    await Preferences.set({ key: PENDING_EXPENSES_KEY, value: JSON.stringify(expenses) });
    
    // Add to sync queue
    await addToSyncQueue({
      type: 'expense',
      data: expense,
    });
  } catch (error) {
    console.error('[OfflineSync] Failed to store pending expense:', error);
  }
}

/**
 * Get pending expenses
 */
export async function getPendingExpenses(): Promise<PendingExpense[]> {
  try {
    const { value } = await Preferences.get({ key: PENDING_EXPENSES_KEY });
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.error('[OfflineSync] Failed to get pending expenses:', error);
    return [];
  }
}

/**
 * Process sync queue when online
 */
export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  const online = await isOnline();
  if (!online) {
    return { synced: 0, failed: 0 };
  }

  const queue = await getSyncQueue();
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      // Skip items that have failed too many times
      if (item.retries >= 3) {
        failed++;
        continue;
      }

      let success = false;

      switch (item.type) {
        case 'receipt':
          // Sync receipt - call your API endpoint
          // This is a placeholder - you'll need to implement the actual API call
          // const response = await fetch('/api/expenses/add', { ... });
          // success = response.ok;
          break;

        case 'expense':
          // Sync expense - call your API endpoint
          // const response = await fetch('/api/expenses/add', { ... });
          // success = response.ok;
          break;

        case 'learning':
          // Sync learning data - already handled by receipt-learning.ts
          success = true;
          break;
      }

      if (success) {
        await removeFromSyncQueue(item.id);
        synced++;
      } else {
        // Increment retry count
        const updatedQueue = await getSyncQueue();
        const itemIndex = updatedQueue.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
          updatedQueue[itemIndex].retries++;
          await Preferences.set({ key: SYNC_QUEUE_KEY, value: JSON.stringify(updatedQueue) });
        }
        failed++;
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to sync item:', error);
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Listen for network status changes and sync when online
 */
export function setupNetworkListener(onOnline?: () => void, onOffline?: () => void): () => void {
  if (!isNativeApp()) {
    const handleOnline = () => {
      processSyncQueue();
      onOnline?.();
    };
    const handleOffline = () => {
      onOffline?.();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  // Native app - use Capacitor Network plugin
  let statusListener: any = null;

  Network.addListener('networkStatusChange', async (status) => {
    if (status.connected) {
      await processSyncQueue();
      onOnline?.();
    } else {
      onOffline?.();
    }
  }).then((listener) => {
    statusListener = listener;
  });

  return () => {
    if (statusListener) {
      Network.removeAllListeners();
    }
  };
}

/**
 * Clear all offline data (for testing/reset)
 */
export async function clearOfflineData(): Promise<void> {
  await Preferences.remove({ key: SYNC_QUEUE_KEY });
  await Preferences.remove({ key: PENDING_RECEIPTS_KEY });
  await Preferences.remove({ key: PENDING_EXPENSES_KEY });
}

