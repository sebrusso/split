/**
 * Shared Supabase Mock for Unit Tests
 *
 * This mock provides a complete fake Supabase client that can be used
 * in unit tests without making actual API calls.
 *
 * Usage:
 *   jest.mock('../lib/supabase', () => require('./__mocks__/supabase'));
 *
 * Or in individual test files:
 *   import { mockSupabase, resetMocks } from './__mocks__/supabase';
 */

// Type for mock query builder results
interface MockQueryResult<T = any> {
  data: T | null;
  error: Error | null;
  count?: number;
}

// Chainable mock query builder
function createMockQueryBuilder<T = any>(defaultData: T | null = null) {
  const state = {
    data: defaultData,
    error: null as Error | null,
    filters: [] as string[],
  };

  const builder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() =>
      Promise.resolve({ data: state.data, error: state.error })
    ),
    maybeSingle: jest.fn().mockImplementation(() =>
      Promise.resolve({ data: state.data, error: state.error })
    ),
    then: (resolve: (value: MockQueryResult<T>) => void) => {
      resolve({ data: state.data, error: state.error });
      return Promise.resolve({ data: state.data, error: state.error });
    },

    // Helper to set mock response for this query
    mockResponse: (data: T | null, error: Error | null = null) => {
      state.data = data;
      state.error = error;
      return builder;
    },
    mockError: (error: Error) => {
      state.error = error;
      state.data = null;
      return builder;
    },
  };

  return builder;
}

// Mock storage bucket
function createMockStorageBucket() {
  return {
    upload: jest.fn().mockResolvedValue({ data: { path: 'mock/path' }, error: null }),
    download: jest.fn().mockResolvedValue({ data: new Blob(), error: null }),
    remove: jest.fn().mockResolvedValue({ data: [], error: null }),
    list: jest.fn().mockResolvedValue({ data: [], error: null }),
    getPublicUrl: jest.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/bucket/${path}` },
    })),
    createSignedUrl: jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://mock.supabase.co/signed-url' },
      error: null,
    }),
  };
}

// Mock auth
const mockAuth = {
  signUp: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
  signInWithPassword: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
  signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: null, provider: null }, error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
  onAuthStateChange: jest.fn().mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  }),
  refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  updateUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
  resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
};

// Mock realtime
const mockRealtime = {
  channel: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn().mockResolvedValue('ok'),
  }),
  removeChannel: jest.fn().mockResolvedValue('ok'),
  removeAllChannels: jest.fn().mockResolvedValue([]),
};

// Mock functions (edge functions)
const mockFunctions = {
  invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
};

// Table data store for more realistic mocking
const tableDataStore: Record<string, any[]> = {};

// Main mock Supabase client
export const mockSupabase = {
  from: jest.fn().mockImplementation((table: string) => {
    const builder = createMockQueryBuilder(tableDataStore[table] || []);
    return builder;
  }),
  storage: {
    from: jest.fn().mockImplementation(() => createMockStorageBucket()),
    listBuckets: jest.fn().mockResolvedValue({ data: [], error: null }),
    createBucket: jest.fn().mockResolvedValue({ data: null, error: null }),
    deleteBucket: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
  auth: mockAuth,
  realtime: mockRealtime,
  functions: mockFunctions,
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),

  // Test helpers
  __setTableData: (table: string, data: any[]) => {
    tableDataStore[table] = data;
  },
  __getTableData: (table: string) => tableDataStore[table] || [],
  __clearTableData: () => {
    Object.keys(tableDataStore).forEach((key) => delete tableDataStore[key]);
  },
};

// Reset all mocks to initial state
export function resetMocks() {
  jest.clearAllMocks();
  mockSupabase.__clearTableData();
}

// Export the mock as the default supabase client
export const supabase = mockSupabase;

// Helper to create a mock error response
export function createMockError(
  message: string,
  code: string = 'MOCK_ERROR'
): { data: null; error: Error & { code: string } } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return { data: null, error };
}

// Helper to create a mock success response
export function createMockSuccess<T>(data: T): { data: T; error: null } {
  return { data, error: null };
}

// Preset mock data generators
export const mockDataGenerators = {
  group: (overrides = {}) => ({
    id: 'mock-group-id',
    name: 'Mock Group',
    emoji: '🧪',
    currency: 'USD',
    share_code: 'MOCK01',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  member: (overrides = {}) => ({
    id: 'mock-member-id',
    group_id: 'mock-group-id',
    name: 'Mock Member',
    user_id: null,
    clerk_user_id: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  expense: (overrides = {}) => ({
    id: 'mock-expense-id',
    group_id: 'mock-group-id',
    description: 'Mock Expense',
    amount: 100,
    paid_by: 'mock-member-id',
    category: 'other',
    expense_date: '2024-01-15',
    created_at: '2024-01-15T12:00:00Z',
    notes: null,
    merchant: null,
    split_type: 'equal',
    deleted_at: null,
    ...overrides,
  }),

  split: (overrides = {}) => ({
    id: 'mock-split-id',
    expense_id: 'mock-expense-id',
    member_id: 'mock-member-id',
    amount: 50,
    ...overrides,
  }),

  settlement: (overrides = {}) => ({
    id: 'mock-settlement-id',
    group_id: 'mock-group-id',
    from_member_id: 'mock-member-id-1',
    to_member_id: 'mock-member-id-2',
    amount: 25,
    settled_at: '2024-01-20T00:00:00Z',
    created_at: '2024-01-20T00:00:00Z',
    ...overrides,
  }),

  userProfile: (overrides = {}) => ({
    id: 'mock-profile-id',
    clerk_id: 'mock-clerk-id',
    email: 'mock@example.com',
    display_name: 'Mock User',
    avatar_url: null,
    default_currency: 'USD',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  activityLog: (overrides = {}) => ({
    id: 'mock-activity-id',
    group_id: 'mock-group-id',
    actor_id: 'mock-clerk-id',
    action: 'expense_added',
    entity_type: 'expense',
    entity_id: 'mock-expense-id',
    metadata: {},
    created_at: '2024-01-15T12:00:00Z',
    ...overrides,
  }),
};

export default { supabase: mockSupabase };
