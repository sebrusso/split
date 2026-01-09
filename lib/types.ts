// Split method types
export type SplitMethod = "equal" | "exact" | "percent" | "shares";

// Category interface (re-exported from categories.ts for convenience)
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  currency: string;
  share_code: string;
  created_at: string;
  archived_at?: string | null;
  pinned?: boolean;
  notes?: string | null;
}

export interface Member {
  id: string;
  group_id: string;
  name: string;
  user_id: string | null; // Legacy UUID column (not used for Clerk)
  clerk_user_id: string | null; // Clerk user ID (TEXT column)
  created_at: string;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  created_at: string;
  // Extended fields (optional for backwards compatibility)
  category?: string;
  expense_date?: string;
  notes?: string | null;
  merchant?: string | null;
  receipt_url?: string | null;
  split_type?: SplitMethod;
  deleted_at?: string | null;
  // Joined fields
  payer?: Member;
  splits?: Split[];
}

// Extended expense with all details for the detail/edit screen
export interface ExpenseWithDetails extends Expense {
  category: string;
  expense_date: string;
  notes: string | null;
  merchant: string | null;
  receipt_url: string | null;
  split_type: SplitMethod;
  deleted_at: string | null;
}

export interface Split {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number;
  // Joined fields
  member?: Member;
}

export interface Balance {
  memberId: string;
  memberName: string;
  amount: number; // Positive = owed money, Negative = owes money
}

export interface Settlement {
  from: Member;
  to: Member;
  amount: number;
}

// Database record for settlements table
export interface SettlementRecord {
  id: string;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  settled_at: string;
  created_at: string;
  method?: string; // Payment method (cash, venmo, paypal, bank_transfer, zelle, other)
  notes?: string | null; // Optional notes about the settlement
  // Joined fields
  from_member?: Member;
  to_member?: Member;
}

// User profile from Clerk authentication
export interface UserProfile {
  id: string;
  clerkId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  defaultCurrency: string;
  createdAt: string;
}

// Friendship status types
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

// Friendship interface
export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
  // Joined fields for display
  friend?: UserProfile;
  requester?: UserProfile;
  addressee?: UserProfile;
}

// Activity action types
export type ActivityAction =
  | 'expense_added'
  | 'expense_edited'
  | 'expense_deleted'
  | 'settlement_recorded'
  | 'member_joined'
  | 'member_left'
  | 'group_created';

// Activity item interface
export interface ActivityItem {
  id: string;
  groupId: string | null;
  actorId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  // Joined fields for display
  actor?: UserProfile;
  group?: Group;
}

// Parameters for logging activity
export interface LogActivityParams {
  groupId?: string;
  actorId: string;
  action: ActivityAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

// ============================================
// Search Types
// ============================================

export interface SearchFilters {
  groupId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  paidBy?: string;
}

export interface SearchResults {
  expenses: Expense[];
  groups: Group[];
}

// ============================================
// Global Balance Types
// ============================================

export interface MemberBalance {
  member: Member;
  balance: number; // Positive = owed, Negative = owes
}

export interface GroupBalance {
  group: Group;
  balance: number; // Net balance for the user in this group
  totalOwed: number; // Total owed to user in this group
  totalOwing: number; // Total user owes in this group
  members: MemberBalance[];
  memberCount: number;
  expenseCount: number;
}

export interface FriendBalance {
  member: Member;
  balance: number; // Net balance with this friend
  groups: { group: Group; balance: number }[];
}

export interface GlobalBalance {
  totalOwed: number; // Total amount others owe you (across all groups)
  totalOwing: number; // Total amount you owe others (across all groups)
  netBalance: number; // totalOwed - totalOwing
  byGroup: GroupBalance[];
  byFriend: FriendBalance[];
}

export interface ExpenseBreakdownItem {
  expenseId: string;
  description: string;
  amount: number;
  date: string;
  groupName: string;
  groupId: string;
  youPaid: number;
  yourShare: number;
  netEffect: number;
}
