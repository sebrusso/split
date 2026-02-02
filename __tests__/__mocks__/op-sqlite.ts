/**
 * Mock for @op-engineering/op-sqlite
 * Used by offline storage tests
 */

export const open = jest.fn(() => ({
  execute: jest.fn().mockResolvedValue({ rows: [] }),
  executeAsync: jest.fn().mockResolvedValue({ rows: [] }),
  close: jest.fn(),
  delete: jest.fn(),
  attach: jest.fn(),
  detach: jest.fn(),
  transaction: jest.fn((callback: () => void) => callback()),
  executeBatch: jest.fn().mockResolvedValue([]),
}));

export const openSync = jest.fn(() => ({
  execute: jest.fn().mockReturnValue({ rows: [] }),
  executeSync: jest.fn().mockReturnValue({ rows: [] }),
  close: jest.fn(),
  delete: jest.fn(),
  attach: jest.fn(),
  detach: jest.fn(),
  transaction: jest.fn((callback: () => void) => callback()),
  executeBatch: jest.fn().mockReturnValue([]),
}));

export default {
  open,
  openSync,
};
