import { open, type DB, type QueryResult } from "@op-engineering/op-sqlite";
import { Group, Member, Expense, Split, SettlementRecord } from "./types";

let db: DB | null = null;

// Operation types for sync queue
export type OperationType = "INSERT" | "UPDATE" | "DELETE";
export type TableName =
  | "groups"
  | "members"
  | "expenses"
  | "splits"
  | "settlements";

export interface QueuedOperation {
  id: number;
  table_name: TableName;
  operation: OperationType;
  record_id: string;
  data: string; // JSON stringified
  created_at: string;
}

// Helper to get rows from query result
function getRows<T>(result: QueryResult): T[] {
  if (!result.rows) return [];
  // op-sqlite returns rows as an array of objects
  return result.rows as unknown as T[];
}

// Initialize the database
export async function initDatabase(): Promise<DB> {
  if (db) return db;

  db = open({
    name: "splitfree.db",
  });

  // Create tables mirroring Supabase schema
  await db.execute(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '',
      currency TEXT DEFAULT 'USD',
      share_code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      archived_at TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (paid_by) REFERENCES members(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS splits (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      from_member_id TEXT NOT NULL,
      to_member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      settled_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      method TEXT DEFAULT 'cash',
      notes TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (from_member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (to_member_id) REFERENCES members(id) ON DELETE CASCADE
    )
  `);

  // Sync queue for pending operations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      record_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_splits_expense ON splits(expense_id)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id)`,
  );

  return db;
}

// Get database instance
export function getDatabase(): DB {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

// Close database
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ============================================
// Cache Operations
// ============================================

// Cache groups
export async function cacheGroups(groups: Group[]): Promise<void> {
  const database = getDatabase();
  const now = new Date().toISOString();

  for (const group of groups) {
    await database.execute(
      `INSERT OR REPLACE INTO groups (id, name, emoji, currency, share_code, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        group.id,
        group.name,
        group.emoji || "",
        group.currency || "USD",
        group.share_code,
        group.created_at,
        now,
        group.archived_at || null,
      ],
    );
  }
}

// Cache members for a group
export async function cacheMembers(members: Member[]): Promise<void> {
  const database = getDatabase();
  const now = new Date().toISOString();

  for (const member of members) {
    await database.execute(
      `INSERT OR REPLACE INTO members (id, group_id, name, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        member.id,
        member.group_id,
        member.name,
        member.user_id,
        member.created_at,
        now,
      ],
    );
  }
}

// Cache expenses for a group
export async function cacheExpenses(expenses: Expense[]): Promise<void> {
  const database = getDatabase();
  const now = new Date().toISOString();

  for (const expense of expenses) {
    await database.execute(
      `INSERT OR REPLACE INTO expenses (id, group_id, description, amount, paid_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        expense.id,
        expense.group_id,
        expense.description,
        expense.amount,
        expense.paid_by,
        expense.created_at,
        now,
      ],
    );

    // Cache splits if present
    if (expense.splits) {
      for (const split of expense.splits) {
        await database.execute(
          `INSERT OR REPLACE INTO splits (id, expense_id, member_id, amount, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [split.id, split.expense_id, split.member_id, split.amount, now],
        );
      }
    }
  }
}

// Cache settlements for a group
export async function cacheSettlements(
  settlements: SettlementRecord[],
): Promise<void> {
  const database = getDatabase();
  const now = new Date().toISOString();

  for (const settlement of settlements) {
    await database.execute(
      `INSERT OR REPLACE INTO settlements (id, group_id, from_member_id, to_member_id, amount, settled_at, created_at, method, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        settlement.id,
        settlement.group_id,
        settlement.from_member_id,
        settlement.to_member_id,
        settlement.amount,
        settlement.settled_at,
        settlement.created_at,
        settlement.method || 'cash',
        settlement.notes || null,
        now,
      ],
    );
  }
}

// ============================================
// Retrieve Cached Data
// ============================================

export async function getCachedGroups(): Promise<Group[]> {
  const database = getDatabase();
  const result = await database.execute(
    `SELECT id, name, emoji, currency, share_code, created_at, archived_at FROM groups WHERE archived_at IS NULL ORDER BY created_at DESC`,
  );

  return getRows<Group>(result);
}

export async function getCachedGroup(groupId: string): Promise<Group | null> {
  const database = getDatabase();
  const result = await database.execute(
    `SELECT id, name, emoji, currency, share_code, created_at, archived_at FROM groups WHERE id = ?`,
    [groupId],
  );

  const rows = getRows<Group>(result);
  return rows.length > 0 ? rows[0] : null;
}

export async function getCachedMembers(groupId: string): Promise<Member[]> {
  const database = getDatabase();
  const result = await database.execute(
    `SELECT id, group_id, name, user_id, created_at FROM members WHERE group_id = ? ORDER BY created_at ASC`,
    [groupId],
  );

  return getRows<Member>(result);
}

export async function getCachedExpenses(groupId: string): Promise<Expense[]> {
  const database = getDatabase();

  // Get expenses
  const expenseResult = await database.execute(
    `SELECT id, group_id, description, amount, paid_by, created_at FROM expenses WHERE group_id = ? ORDER BY created_at DESC`,
    [groupId],
  );

  const expenses = getRows<Expense>(expenseResult);

  // Get splits for each expense
  for (const expense of expenses) {
    const splitResult = await database.execute(
      `SELECT s.id, s.expense_id, s.member_id, s.amount, m.name as member_name
       FROM splits s
       LEFT JOIN members m ON s.member_id = m.id
       WHERE s.expense_id = ?`,
      [expense.id],
    );

    interface SplitRow {
      id: string;
      expense_id: string;
      member_id: string;
      amount: number;
      member_name?: string;
    }
    const splitRows = getRows<SplitRow>(splitResult);
    expense.splits = splitRows.map((row) => ({
      id: row.id,
      expense_id: row.expense_id,
      member_id: row.member_id,
      amount: row.amount,
      member: row.member_name
        ? { id: row.member_id, name: row.member_name }
        : undefined,
    })) as Split[];

    // Get payer info
    const payerResult = await database.execute(
      `SELECT id, group_id, name, user_id, created_at FROM members WHERE id = ?`,
      [expense.paid_by],
    );

    const payerRows = getRows<Member>(payerResult);
    if (payerRows.length > 0) {
      expense.payer = payerRows[0];
    }
  }

  return expenses;
}

export async function getCachedSettlements(
  groupId: string,
): Promise<SettlementRecord[]> {
  const database = getDatabase();
  const result = await database.execute(
    `SELECT s.id, s.group_id, s.from_member_id, s.to_member_id, s.amount, s.settled_at, s.created_at, s.method, s.notes,
            fm.name as from_member_name, tm.name as to_member_name
     FROM settlements s
     LEFT JOIN members fm ON s.from_member_id = fm.id
     LEFT JOIN members tm ON s.to_member_id = tm.id
     WHERE s.group_id = ?
     ORDER BY s.settled_at DESC`,
    [groupId],
  );

  interface SettlementRow {
    id: string;
    group_id: string;
    from_member_id: string;
    to_member_id: string;
    amount: number;
    settled_at: string;
    created_at: string;
    method?: string;
    notes?: string;
    from_member_name?: string;
    to_member_name?: string;
  }
  const rows = getRows<SettlementRow>(result);
  return rows.map((row) => ({
    id: row.id,
    group_id: row.group_id,
    from_member_id: row.from_member_id,
    to_member_id: row.to_member_id,
    amount: row.amount,
    settled_at: row.settled_at,
    created_at: row.created_at,
    method: row.method,
    notes: row.notes,
    from_member: row.from_member_name
      ? { id: row.from_member_id, name: row.from_member_name }
      : undefined,
    to_member: row.to_member_name
      ? { id: row.to_member_id, name: row.to_member_name }
      : undefined,
  })) as SettlementRecord[];
}

// ============================================
// Sync Queue Operations
// ============================================

export async function queueOperation(
  tableName: TableName,
  operation: OperationType,
  recordId: string,
  data: object,
): Promise<void> {
  const database = getDatabase();
  await database.execute(
    `INSERT INTO sync_queue (table_name, operation, record_id, data)
     VALUES (?, ?, ?, ?)`,
    [tableName, operation, recordId, JSON.stringify(data)],
  );
}

export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const database = getDatabase();
  const result = await database.execute(
    `SELECT id, table_name, operation, record_id, data, created_at
     FROM sync_queue
     ORDER BY id ASC`,
  );

  return getRows<QueuedOperation>(result);
}

export async function removeFromQueue(operationId: number): Promise<void> {
  const database = getDatabase();
  await database.execute(`DELETE FROM sync_queue WHERE id = ?`, [operationId]);
}

export async function clearSyncQueue(): Promise<void> {
  const database = getDatabase();
  await database.execute(`DELETE FROM sync_queue`);
}

export async function getSyncQueueCount(): Promise<number> {
  const database = getDatabase();
  const result = await database.execute(
    `SELECT COUNT(*) as count FROM sync_queue`,
  );
  const rows = getRows<{ count: number }>(result);
  return rows.length > 0 ? rows[0].count : 0;
}

// ============================================
// Delete Operations (for local cache)
// ============================================

export async function deleteCachedGroup(groupId: string): Promise<void> {
  const database = getDatabase();
  await database.execute(`DELETE FROM groups WHERE id = ?`, [groupId]);
}

export async function deleteCachedMember(memberId: string): Promise<void> {
  const database = getDatabase();
  await database.execute(`DELETE FROM members WHERE id = ?`, [memberId]);
}

export async function deleteCachedExpense(expenseId: string): Promise<void> {
  const database = getDatabase();
  await database.execute(`DELETE FROM expenses WHERE id = ?`, [expenseId]);
}

export async function deleteCachedSettlement(
  settlementId: string,
): Promise<void> {
  const database = getDatabase();
  await database.execute(`DELETE FROM settlements WHERE id = ?`, [
    settlementId,
  ]);
}

// Clear all cached data
export async function clearAllCache(): Promise<void> {
  const database = getDatabase();
  await database.execute(`DELETE FROM splits`);
  await database.execute(`DELETE FROM expenses`);
  await database.execute(`DELETE FROM settlements`);
  await database.execute(`DELETE FROM members`);
  await database.execute(`DELETE FROM groups`);
}
