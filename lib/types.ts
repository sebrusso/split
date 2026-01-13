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
  // Multi-currency support
  currency?: string | null; // Currency code (e.g., USD, EUR). NULL means use group currency
  exchange_rate?: number | null; // Exchange rate to group currency at time of expense creation
  exchange_rate_time?: string | null; // When the exchange rate was fetched
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
  venmoUsername: string | null;
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

// ============================================
// Receipt Scanning Types
// ============================================

export type ReceiptStatus = 'draft' | 'processing' | 'claiming' | 'settled' | 'archived';
export type OCRStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type OCRProvider = 'gemini' | 'google_vision' | 'claude' | 'gpt4v' | 'textract';
export type ClaimType = 'full' | 'split' | 'partial';
export type ClaimSource = 'app' | 'imessage' | 'web' | 'assigned';

export interface Receipt {
  id: string;
  group_id?: string | null; // Nullable for unassigned receipts
  uploaded_by?: string | null; // Member ID, nullable for unassigned receipts
  uploaded_by_clerk_id?: string | null; // Clerk user ID for tracking ownership of unassigned receipts

  // Image
  image_url: string;
  image_thumbnail_url?: string | null;

  // OCR results
  ocr_status: OCRStatus;
  ocr_provider?: OCRProvider | null;
  ocr_raw_response?: Record<string, unknown> | null;
  ocr_confidence?: number | null;

  // Extracted metadata
  merchant_name?: string | null;
  merchant_address?: string | null;
  receipt_date?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  tip_amount?: number | null;
  total_amount?: number | null;
  currency: string;

  // Enhanced receipt scanning fields
  discount_amount?: number | null;
  service_charge_amount?: number | null;

  // Status
  status: ReceiptStatus;
  claim_deadline?: string | null;
  share_code?: string | null;

  created_at: string;
  updated_at: string;

  // Joined fields
  items?: ReceiptItem[];
  uploader?: Member;
}

// Service charge types
export type ServiceChargeType = 'gratuity' | 'delivery' | 'convenience' | 'other';

export interface ReceiptItem {
  id: string;
  receipt_id: string;

  // Item details
  description: string;
  quantity: number;
  unit_price?: number | null;
  total_price: number;

  // OCR metadata
  original_text?: string | null;
  confidence?: number | null;
  bounding_box?: Record<string, number> | null;

  // Ordering
  line_number?: number | null;

  // Flags for special items
  is_tax: boolean;
  is_tip: boolean;
  is_discount: boolean;
  is_subtotal: boolean;
  is_total: boolean;

  // Multi-quantity expansion (P0)
  original_quantity?: number | null; // Original quantity before expansion
  expanded_from_id?: string | null; // Points to parent item when expanded
  is_expansion?: boolean; // True if created by expanding multi-quantity item

  // Shared item detection (P0)
  is_likely_shared?: boolean; // True if OCR detected as shared item

  // Modifier/add-on grouping (P1)
  is_modifier?: boolean; // True if this is an add-on (e.g., "+ Extra Cheese")
  parent_item_id?: string | null; // Points to main item this modifier belongs to

  // Service charge detection (P1)
  is_service_charge?: boolean; // True if this is a service charge
  service_charge_type?: ServiceChargeType | null; // Type of service charge

  // Discount attribution (P1)
  applies_to_item_id?: string | null; // For item-specific discounts

  created_at: string;

  // Joined fields
  claims?: ItemClaim[];
  modifiers?: ReceiptItem[]; // Child modifiers for this item
  expanded_items?: ReceiptItem[]; // Expanded individual items from multi-quantity
}

export interface ItemClaim {
  id: string;
  receipt_item_id: string;
  member_id: string;

  // Claim type
  claim_type: ClaimType;
  share_fraction: number;
  share_amount?: number | null;
  split_count: number;

  claimed_at: string;
  claimed_via: ClaimSource;

  // Joined fields
  member?: Member;
  receipt_item?: ReceiptItem;
}

export interface ReceiptMemberTotal {
  id: string;
  receipt_id: string;
  member_id: string;

  items_total: number;
  tax_share: number;
  tip_share: number;
  grand_total: number;

  is_settled: boolean;
  settled_at?: string | null;
  settlement_id?: string | null;

  updated_at: string;

  // Joined fields
  member?: Member;
}

// OCR extraction result types
export interface OCRExtractedItem {
  description: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
  confidence?: number;
  originalText?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };

  // Enhanced fields (P0/P1)
  isLikelyShared?: boolean; // Detected as shared item (pitcher, appetizer, etc.)
  isModifier?: boolean; // Is this a modifier/add-on?
  parentItemIndex?: number | null; // Index of parent item for modifiers
  isServiceCharge?: boolean; // Is this a service charge?
  serviceChargeType?: ServiceChargeType; // Type of service charge
}

// Service charge from OCR
export interface OCRServiceCharge {
  description: string;
  amount: number;
  type?: ServiceChargeType;
}

// Discount from OCR
export interface OCRDiscount {
  description: string;
  amount: number; // Negative value
  appliesToItemIndex?: number | null; // null = applies to whole receipt
}

// Tax entry from OCR (supporting multiple tax rates)
export interface OCRTaxEntry {
  type?: string; // e.g., "Sales Tax", "Alcohol Tax"
  amount: number;
}

export interface OCRExtractedMetadata {
  merchantName?: string;
  merchantAddress?: string;
  date?: string;
  subtotal?: number;
  tax?: number; // Legacy single tax (sum of all taxes)
  taxes?: OCRTaxEntry[]; // Enhanced: multiple tax entries
  tip?: number;
  total?: number;
  currency?: string;

  // Enhanced fields (P1)
  serviceCharges?: OCRServiceCharge[];
  discounts?: OCRDiscount[];
}

export interface OCRResult {
  items: OCRExtractedItem[];
  metadata: OCRExtractedMetadata;
  rawText?: string;
  confidence: number;
  provider: OCRProvider;
}

// Receipt calculation types
export interface ReceiptMemberCalculation {
  memberId: string;
  memberName: string;
  itemsTotal: number;
  taxShare: number;
  tipShare: number;
  grandTotal: number;
  claimedItems: Array<{
    itemId: string;
    description: string;
    amount: number;
    shareFraction: number;
  }>;
}

export interface ReceiptSummary {
  receiptId: string;
  merchantName?: string;
  receiptDate?: string;
  itemCount: number;
  claimedItemCount: number;
  unclaimedItemCount: number;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  memberTotals: ReceiptMemberCalculation[];
}
