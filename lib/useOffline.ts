import { useState, useEffect, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { supabase } from "./supabase";
import { Group, Member, Expense, SettlementRecord } from "./types";
import type { TableName, OperationType } from "./offline";

// Type definitions for dynamically imported modules
interface OfflineModule {
  initDatabase: () => Promise<unknown>;
  cacheGroups: (groups: Group[]) => Promise<void>;
  cacheMembers: (members: Member[]) => Promise<void>;
  cacheExpenses: (expenses: Expense[]) => Promise<void>;
  cacheSettlements: (settlements: SettlementRecord[]) => Promise<void>;
  getCachedGroups: () => Promise<Group[]>;
  getCachedGroup: (groupId: string) => Promise<Group | null>;
  getCachedMembers: (groupId: string) => Promise<Member[]>;
  getCachedExpenses: (groupId: string) => Promise<Expense[]>;
  getCachedSettlements: (groupId: string) => Promise<SettlementRecord[]>;
  getSyncQueueCount: () => Promise<number>;
  queueOperation: (
    tableName: TableName,
    operation: OperationType,
    recordId: string,
    data: object
  ) => Promise<void>;
}

interface SyncModule {
  initSync: () => void;
  cleanupSync: () => void;
  getNetworkStatus: () => boolean;
  getSyncStatus: () => SyncStatus;
  subscribeSyncStatus: (callback: (status: SyncStatus) => void) => () => void;
  syncPendingOperations: () => Promise<{ success: boolean; synced: number; failed: number }>;
}

// Offline support is optional - native modules may not be available in Expo Go
let offlineModule: OfflineModule | null = null;
let syncModule: SyncModule | null = null;
let isInitialized = false;
let offlineAvailable = false;

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

// Try to load native modules dynamically
async function loadOfflineModules(): Promise<boolean> {
  try {
    offlineModule = await import("./offline");
    syncModule = await import("./sync");
    return true;
  } catch (error) {
    console.warn(
      "Offline support not available (native modules required for development builds):",
      error,
    );
    return false;
  }
}

export async function initOfflineSupport(): Promise<void> {
  if (isInitialized) return;

  offlineAvailable = await loadOfflineModules();

  if (offlineAvailable && offlineModule && syncModule) {
    try {
      await offlineModule.initDatabase();
      syncModule.initSync();
    } catch (error) {
      console.warn("Failed to initialize offline support:", error);
      offlineAvailable = false;
    }
  }

  isInitialized = true;
}

export function cleanupOfflineSupport(): void {
  if (offlineAvailable && syncModule) {
    syncModule.cleanupSync();
  }
  isInitialized = false;
}

// Helper functions that safely use offline modules
function getNetworkStatus(): boolean {
  if (offlineAvailable && syncModule) {
    return syncModule.getNetworkStatus();
  }
  return true; // Assume online if offline support unavailable
}

function _getSyncStatus(): SyncStatus {
  if (offlineAvailable && syncModule) {
    return syncModule.getSyncStatus();
  }
  return "idle";
}

function subscribeSyncStatus(
  callback: (status: SyncStatus) => void,
): () => void {
  if (offlineAvailable && syncModule) {
    return syncModule.subscribeSyncStatus(callback);
  }
  return () => {}; // No-op unsubscribe
}

async function syncPendingOperations(): Promise<void> {
  if (offlineAvailable && syncModule) {
    await syncModule.syncPendingOperations();
  }
}

async function getSyncQueueCount(): Promise<number> {
  if (offlineAvailable && offlineModule) {
    return offlineModule.getSyncQueueCount();
  }
  return 0;
}

// Cache functions that no-op when offline support unavailable
async function cacheGroups(groups: Group[]): Promise<void> {
  if (offlineAvailable && offlineModule) {
    await offlineModule.cacheGroups(groups);
  }
}

async function cacheMembers(members: Member[]): Promise<void> {
  if (offlineAvailable && offlineModule) {
    await offlineModule.cacheMembers(members);
  }
}

async function cacheExpenses(expenses: Expense[]): Promise<void> {
  if (offlineAvailable && offlineModule) {
    await offlineModule.cacheExpenses(expenses);
  }
}

async function cacheSettlements(settlements: SettlementRecord[]): Promise<void> {
  if (offlineAvailable && offlineModule) {
    await offlineModule.cacheSettlements(settlements);
  }
}

async function getCachedGroups(): Promise<Group[]> {
  if (offlineAvailable && offlineModule) {
    return offlineModule.getCachedGroups();
  }
  return [];
}

async function getCachedGroup(groupId: string): Promise<Group | null> {
  if (offlineAvailable && offlineModule) {
    return offlineModule.getCachedGroup(groupId);
  }
  return null;
}

async function getCachedMembers(groupId: string): Promise<Member[]> {
  if (offlineAvailable && offlineModule) {
    return offlineModule.getCachedMembers(groupId);
  }
  return [];
}

async function getCachedExpenses(groupId: string): Promise<Expense[]> {
  if (offlineAvailable && offlineModule) {
    return offlineModule.getCachedExpenses(groupId);
  }
  return [];
}

async function getCachedSettlements(
  groupId: string,
): Promise<SettlementRecord[]> {
  if (offlineAvailable && offlineModule) {
    return offlineModule.getCachedSettlements(groupId);
  }
  return [];
}

async function queueOperation(
  tableName: TableName,
  operation: OperationType,
  recordId: string,
  data: object,
): Promise<void> {
  if (offlineAvailable && offlineModule) {
    await offlineModule.queueOperation(tableName, operation, recordId, data);
  }
}

// Hook for sync status
export function useSyncStatus(): {
  status: SyncStatus;
  pendingCount: number;
  isOnline: boolean;
} {
  const [status, setStatus] = useState<SyncStatus>(_getSyncStatus());
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(getNetworkStatus());

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((newStatus: SyncStatus) => {
      setStatus(newStatus);
      setIsOnline(getNetworkStatus());
    });

    // Update pending count periodically
    const interval = setInterval(async () => {
      try {
        const count = await getSyncQueueCount();
        setPendingCount(count);
      } catch {
        // Database might not be initialized yet
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return { status, pendingCount, isOnline };
}

// Hook for fetching groups with offline support
export function useGroups(): {
  groups: Group[];
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
} {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGroups = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      // Always try network first (or if offline support unavailable)
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setGroups(data);
        await cacheGroups(data);
        return;
      }

      // Fall back to cache if available
      if (offlineAvailable) {
        const cached = await getCachedGroups();
        setGroups(cached);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
      // Try cache as fallback
      if (offlineAvailable) {
        try {
          const cached = await getCachedGroups();
          setGroups(cached);
        } catch {
          // Cache not available
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const refresh = useCallback(async () => {
    await fetchGroups(true);
  }, [fetchGroups]);

  return { groups, loading, refreshing, refresh };
}

// Hook for fetching group details with offline support
export function useGroupDetails(groupId: string): {
  group: Group | null;
  members: Member[];
  expenses: Expense[];
  settlements: SettlementRecord[];
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
} {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);

      try {
        // Fetch from network
        const [groupRes, membersRes, expensesRes, settlementsRes] =
          await Promise.all([
            supabase.from("groups").select("*").eq("id", groupId).single(),
            supabase
              .from("members")
              .select("*")
              .eq("group_id", groupId)
              .order("created_at", { ascending: true }),
            supabase
              .from("expenses")
              .select(
                `*, payer:members!paid_by(id, name), splits(*, member:members(id, name))`,
              )
              .eq("group_id", groupId)
              .order("created_at", { ascending: false }),
            supabase
              .from("settlements")
              .select(
                `*, from_member:members!from_member_id(id, name), to_member:members!to_member_id(id, name)`,
              )
              .eq("group_id", groupId)
              .order("settled_at", { ascending: false }),
          ]);

        if (!groupRes.error && groupRes.data) {
          setGroup(groupRes.data);
          await cacheGroups([groupRes.data]);
        }

        if (!membersRes.error && membersRes.data) {
          setMembers(membersRes.data);
          await cacheMembers(membersRes.data);
        }

        if (!expensesRes.error && expensesRes.data) {
          setExpenses(expensesRes.data);
          await cacheExpenses(expensesRes.data);
        }

        if (!settlementsRes.error && settlementsRes.data) {
          setSettlements(settlementsRes.data);
          await cacheSettlements(settlementsRes.data);
        }
      } catch (error) {
        console.error("Error fetching group details:", error);
        // Try cache as fallback
        if (offlineAvailable) {
          try {
            const [
              cachedGroup,
              cachedMembers,
              cachedExpenses,
              cachedSettlements,
            ] = await Promise.all([
              getCachedGroup(groupId),
              getCachedMembers(groupId),
              getCachedExpenses(groupId),
              getCachedSettlements(groupId),
            ]);

            setGroup(cachedGroup);
            setMembers(cachedMembers);
            setExpenses(cachedExpenses);
            setSettlements(cachedSettlements);
          } catch {
            // Cache not available
          }
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [groupId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    group,
    members,
    expenses,
    settlements,
    loading,
    refreshing,
    refresh,
  };
}

// Hook for app foreground sync
export function useAppForegroundSync(): void {
  useEffect(() => {
    if (!offlineAvailable) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && getNetworkStatus()) {
        await syncPendingOperations();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, []);
}

// Offline-aware data operations
// Generic error type for Supabase-like responses
interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export async function createGroupOffline(
  groupData: Omit<Group, "id" | "created_at">,
): Promise<{ data: Group | null; error: SupabaseError | null }> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const group: Group = { ...groupData, id, created_at };

  // Always try online first
  const result = await supabase.from("groups").insert(group).select().single();

  if (!result.error && result.data) {
    await cacheGroups([result.data]);
    return result;
  }

  // If offline and offline support available, queue
  if (offlineAvailable && !getNetworkStatus()) {
    await cacheGroups([group]);
    await queueOperation("groups", "INSERT", id, group);
    return { data: group, error: null };
  }

  return result;
}

export async function createMemberOffline(
  memberData: Omit<Member, "id" | "created_at">,
): Promise<{ data: Member | null; error: SupabaseError | null }> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const member: Member = { ...memberData, id, created_at };

  const result = await supabase
    .from("members")
    .insert(member)
    .select()
    .single();

  if (!result.error && result.data) {
    await cacheMembers([result.data]);
    return result;
  }

  if (offlineAvailable && !getNetworkStatus()) {
    await cacheMembers([member]);
    await queueOperation("members", "INSERT", id, member);
    return { data: member, error: null };
  }

  return result;
}

export async function createExpenseOffline(
  expenseData: Omit<Expense, "id" | "created_at">,
  splits: Array<{ member_id: string; amount: number }>,
): Promise<{ data: Expense | null; error: SupabaseError | null }> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const expense: Expense = { ...expenseData, id, created_at };

  const result = await supabase
    .from("expenses")
    .insert(expense)
    .select()
    .single();

  if (!result.error) {
    const splitsToInsert = splits.map((s) => ({
      expense_id: id,
      member_id: s.member_id,
      amount: s.amount,
    }));
    await supabase.from("splits").insert(splitsToInsert);

    expense.splits = splitsToInsert.map((s, i) => ({
      id: `${id}-${i}`,
      ...s,
    }));
    await cacheExpenses([expense]);
    return { data: expense, error: null };
  }

  if (offlineAvailable && !getNetworkStatus()) {
    expense.splits = splits.map((s, i) => ({
      id: `${id}-${i}`,
      expense_id: id,
      ...s,
    }));
    await cacheExpenses([expense]);
    await queueOperation("expenses", "INSERT", id, expense);
    for (let i = 0; i < splits.length; i++) {
      await queueOperation("splits", "INSERT", `${id}-${i}`, {
        id: `${id}-${i}`,
        expense_id: id,
        ...splits[i],
      });
    }
    return { data: expense, error: null };
  }

  return result;
}

export async function createSettlementOffline(
  settlementData: Omit<SettlementRecord, "id" | "created_at" | "settled_at">,
): Promise<{ data: SettlementRecord | null; error: SupabaseError | null }> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const settlement: SettlementRecord = {
    ...settlementData,
    id,
    settled_at: now,
    created_at: now,
  };

  const result = await supabase
    .from("settlements")
    .insert(settlement)
    .select()
    .single();

  if (!result.error && result.data) {
    await cacheSettlements([result.data]);
    return result;
  }

  if (offlineAvailable && !getNetworkStatus()) {
    await cacheSettlements([settlement]);
    await queueOperation("settlements", "INSERT", id, settlement);
    return { data: settlement, error: null };
  }

  return result;
}

export async function deleteSettlementOffline(
  settlementId: string,
): Promise<{ error: SupabaseError | null }> {
  const result = await supabase
    .from("settlements")
    .delete()
    .eq("id", settlementId);

  if (result.error && offlineAvailable && !getNetworkStatus()) {
    await queueOperation("settlements", "DELETE", settlementId, {
      id: settlementId,
    });
    return { error: null };
  }

  return result;
}
