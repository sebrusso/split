import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { supabase } from "./supabase";
import {
  getPendingOperations,
  removeFromQueue,
  QueuedOperation,
  TableName,
  cacheGroups,
  cacheMembers,
  cacheExpenses,
  cacheSettlements,
} from "./offline";
import { Group, Member, Expense, SettlementRecord } from "./types";

// Network status
let isOnline = true;
let networkUnsubscribe: (() => void) | null = null;

// Sync status
export type SyncStatus = "idle" | "syncing" | "error" | "offline";
let currentSyncStatus: SyncStatus = "idle";
let syncListeners: Array<(status: SyncStatus) => void> = [];

// ============================================
// Network Status
// ============================================

export function initNetworkListener(): void {
  networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const wasOffline = !isOnline;
    isOnline = state.isConnected ?? false;

    // If we just came online, trigger sync
    if (wasOffline && isOnline) {
      syncPendingOperations();
    }

    // Update sync status
    if (!isOnline) {
      setSyncStatus("offline");
    } else if (currentSyncStatus === "offline") {
      setSyncStatus("idle");
    }
  });
}

export function removeNetworkListener(): void {
  if (networkUnsubscribe) {
    networkUnsubscribe();
    networkUnsubscribe = null;
  }
}

export function getNetworkStatus(): boolean {
  return isOnline;
}

export async function checkNetworkStatus(): Promise<boolean> {
  const state = await NetInfo.fetch();
  isOnline = state.isConnected ?? false;
  return isOnline;
}

// ============================================
// Sync Status Management
// ============================================

function setSyncStatus(status: SyncStatus): void {
  currentSyncStatus = status;
  syncListeners.forEach((listener) => listener(status));
}

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

export function subscribeSyncStatus(
  listener: (status: SyncStatus) => void,
): () => void {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
}

// ============================================
// Sync Operations
// ============================================

export async function syncPendingOperations(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
}> {
  if (!isOnline) {
    return { success: false, synced: 0, failed: 0 };
  }

  const operations = await getPendingOperations();
  if (operations.length === 0) {
    return { success: true, synced: 0, failed: 0 };
  }

  setSyncStatus("syncing");

  let synced = 0;
  let failed = 0;

  for (const operation of operations) {
    try {
      await processSyncOperation(operation);
      await removeFromQueue(operation.id);
      synced++;
    } catch (error) {
      console.error("Sync operation failed:", error);
      failed++;
    }
  }

  setSyncStatus(failed > 0 ? "error" : "idle");

  return { success: failed === 0, synced, failed };
}

async function processSyncOperation(operation: QueuedOperation): Promise<void> {
  const data = JSON.parse(operation.data);

  switch (operation.operation) {
    case "INSERT":
      await handleInsert(operation.table_name, data);
      break;
    case "UPDATE":
      await handleUpdate(operation.table_name, operation.record_id, data);
      break;
    case "DELETE":
      await handleDelete(operation.table_name, operation.record_id);
      break;
  }
}

async function handleInsert(
  tableName: TableName,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from(tableName).insert(data);

  if (error) {
    // Check for duplicate key (record already exists)
    if (error.code === "23505") {
      // Record already exists, try update instead
      const { id, ...updateData } = data as { id: string } & Record<
        string,
        unknown
      >;
      await handleUpdate(tableName, id, updateData);
      return;
    }
    throw error;
  }
}

async function handleUpdate(
  tableName: TableName,
  recordId: string,
  data: Record<string, unknown>,
): Promise<void> {
  // Remove id from data if present
  const { id, ...updateData } = data as { id?: string } & Record<
    string,
    unknown
  >;

  const { error } = await supabase
    .from(tableName)
    .update(updateData)
    .eq("id", recordId);

  if (error) {
    throw error;
  }
}

async function handleDelete(
  tableName: TableName,
  recordId: string,
): Promise<void> {
  const { error } = await supabase.from(tableName).delete().eq("id", recordId);

  if (error) {
    // Ignore "not found" errors for deletes
    if (error.code !== "PGRST116") {
      throw error;
    }
  }
}

// ============================================
// Conflict Resolution (Last Write Wins)
// ============================================

export function resolveConflict<T extends { updated_at?: string }>(
  local: T,
  remote: T,
): T {
  // Last write wins based on updated_at timestamp
  const localTime = local.updated_at
    ? new Date(local.updated_at).getTime()
    : 0;
  const remoteTime = remote.updated_at
    ? new Date(remote.updated_at).getTime()
    : 0;

  return remoteTime >= localTime ? remote : local;
}

// ============================================
// Full Sync (Pull from Supabase)
// ============================================

export async function pullGroupData(
  groupId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isOnline) {
    return { success: false, error: "Offline" };
  }

  try {
    // Fetch group
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (groupError) throw groupError;
    if (group) await cacheGroups([group as Group]);

    // Fetch members
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("*")
      .eq("group_id", groupId);

    if (membersError) throw membersError;
    if (members) await cacheMembers(members as Member[]);

    // Fetch expenses with splits
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select(`*, splits(*)`)
      .eq("group_id", groupId);

    if (expensesError) throw expensesError;
    if (expenses) await cacheExpenses(expenses as Expense[]);

    // Fetch settlements
    const { data: settlements, error: settlementsError } = await supabase
      .from("settlements")
      .select("*")
      .eq("group_id", groupId);

    if (settlementsError) throw settlementsError;
    if (settlements) await cacheSettlements(settlements as SettlementRecord[]);

    return { success: true };
  } catch (error) {
    console.error("Pull group data failed:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, error: message };
  }
}

export async function pullAllGroups(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isOnline) {
    return { success: false, error: "Offline" };
  }

  try {
    const { data: groups, error } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (groups) await cacheGroups(groups as Group[]);

    return { success: true };
  } catch (error) {
    console.error("Pull all groups failed:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, error: message };
  }
}

// ============================================
// Background Sync
// ============================================

let syncInterval: ReturnType<typeof setInterval> | null = null;
const SYNC_INTERVAL_MS = 30000; // 30 seconds

export function startBackgroundSync(): void {
  if (syncInterval) return;

  syncInterval = setInterval(async () => {
    if (isOnline) {
      await syncPendingOperations();
    }
  }, SYNC_INTERVAL_MS);
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// ============================================
// Initialize/Cleanup
// ============================================

export function initSync(): void {
  initNetworkListener();
  startBackgroundSync();
}

export function cleanupSync(): void {
  removeNetworkListener();
  stopBackgroundSync();
  syncListeners = [];
}
