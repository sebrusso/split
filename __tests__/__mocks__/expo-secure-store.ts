/**
 * Mock for expo-secure-store
 * Used in Jest tests to avoid native module dependencies
 */

const store: Record<string, string> = {};

export const getItemAsync = jest.fn(async (key: string): Promise<string | null> => {
  return store[key] ?? null;
});

export const setItemAsync = jest.fn(async (key: string, value: string): Promise<void> => {
  store[key] = value;
});

export const deleteItemAsync = jest.fn(async (key: string): Promise<void> => {
  delete store[key];
});

// Helper to reset the store between tests
export const __resetStore = () => {
  Object.keys(store).forEach((key) => delete store[key]);
};

export default {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
};
