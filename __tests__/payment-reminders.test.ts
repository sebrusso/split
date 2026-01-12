/**
 * Payment Reminders Unit Tests
 *
 * Tests for payment reminder scheduling, suggestion timing,
 * and message templates.
 *
 * Note: These tests only cover pure functions that don't require
 * database connections.
 */

// Mock the supabase module to prevent connection errors
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        not: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    functions: {
      invoke: jest.fn(() => Promise.resolve({ data: { sent: 0 }, error: null })),
    },
  },
}));

// Mock notifications module
jest.mock('../lib/notifications', () => ({
  sendPushNotifications: jest.fn(() => Promise.resolve({ success: true, sent: 0 })),
  scheduleLocalNotification: jest.fn(() => Promise.resolve('notification-id')),
}));

import {
  suggestReminderTime,
  isGoodTimeForReminder,
  getDaysUntilOverdue,
  getReminderMessage,
  type ReminderFrequency,
} from '../lib/payment-reminders';

// ============================================
// Reminder Time Suggestions Tests
// ============================================

describe('suggestReminderTime', () => {
  const originalDate = global.Date;

  afterEach(() => {
    global.Date = originalDate;
  });

  it('suggests 10am for early morning', () => {
    // Mock date at 8am
    const mockDate = new Date(2026, 0, 12, 8, 0, 0);
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const suggested = suggestReminderTime();

    expect(suggested.getHours()).toBe(10);
    expect(suggested.getMinutes()).toBe(0);
    expect(suggested.getDate()).toBe(12); // Same day
  });

  it('suggests 6pm for midday', () => {
    // Mock date at 2pm
    const mockDate = new Date(2026, 0, 12, 14, 0, 0);
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const suggested = suggestReminderTime();

    expect(suggested.getHours()).toBe(18);
    expect(suggested.getMinutes()).toBe(0);
    expect(suggested.getDate()).toBe(12); // Same day
  });

  it('suggests 10am next day for evening', () => {
    // Mock date at 8pm
    const mockDate = new Date(2026, 0, 12, 20, 0, 0);
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const suggested = suggestReminderTime();

    expect(suggested.getHours()).toBe(10);
    expect(suggested.getMinutes()).toBe(0);
    expect(suggested.getDate()).toBe(13); // Next day
  });
});

describe('isGoodTimeForReminder', () => {
  const originalDate = global.Date;

  afterEach(() => {
    global.Date = originalDate;
  });

  it('returns true during reasonable hours (9am-9pm)', () => {
    const hours = [9, 10, 12, 14, 17, 20, 21];

    for (const hour of hours) {
      const mockDate = new Date(2026, 0, 12, hour, 0, 0);
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      expect(isGoodTimeForReminder()).toBe(true);
    }
  });

  it('returns false during unreasonable hours (before 9am, after 9pm)', () => {
    const hours = [0, 3, 6, 8, 22, 23];

    for (const hour of hours) {
      const mockDate = new Date(2026, 0, 12, hour, 0, 0);
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      expect(isGoodTimeForReminder()).toBe(false);
    }
  });
});

// ============================================
// Overdue Calculation Tests
// ============================================

describe('getDaysUntilOverdue', () => {
  it('returns 7 for newly created balances', () => {
    // Use real current date - this test checks the threshold logic
    const now = new Date();
    const createdAt = now.toISOString();
    expect(getDaysUntilOverdue(createdAt)).toBe(7);
  });

  it('returns decreasing days as time passes', () => {
    // Created 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const result = getDaysUntilOverdue(threeDaysAgo.toISOString());
    expect(result).toBe(4); // 7 - 3 = 4 days left
  });

  it('returns 0 when overdue', () => {
    // Created 13 days ago (past 7 day threshold)
    const thirteenDaysAgo = new Date();
    thirteenDaysAgo.setDate(thirteenDaysAgo.getDate() - 13);

    const result = getDaysUntilOverdue(thirteenDaysAgo.toISOString());
    expect(result).toBe(0);
  });

  it('returns 0 for exactly 7 days', () => {
    // Created exactly 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = getDaysUntilOverdue(sevenDaysAgo.toISOString());
    expect(result).toBe(0);
  });
});

// ============================================
// Reminder Message Templates Tests
// ============================================

describe('getReminderMessage', () => {
  describe('friendly type', () => {
    it('generates friendly message', () => {
      const { title, body } = getReminderMessage('friendly', 'Alice', '$50.00');

      expect(title).toBe('Quick reminder');
      expect(body).toContain('friendly nudge');
      expect(body).toContain('Alice');
      expect(body).toContain('$50.00');
      expect(body).toContain('when you get a chance');
    });
  });

  describe('reminder type', () => {
    it('generates reminder message', () => {
      const { title, body } = getReminderMessage('reminder', 'Bob', '$25.00');

      expect(title).toBe('Payment Reminder');
      expect(body).toContain('still owe');
      expect(body).toContain('Bob');
      expect(body).toContain('$25.00');
      expect(body).toContain('Tap to settle up');
    });
  });

  describe('urgent type', () => {
    it('generates urgent message', () => {
      const { title, body } = getReminderMessage('urgent', 'Charlie', '$100.00');

      expect(title).toBe('Payment Overdue');
      expect(body).toContain('overdue');
      expect(body).toContain('Charlie');
      expect(body).toContain('$100.00');
      expect(body).toContain('Please settle up soon');
    });
  });

  describe('default/unknown type', () => {
    it('generates basic message for unknown types', () => {
      const { title, body } = getReminderMessage(
        'unknown' as 'friendly' | 'reminder' | 'urgent',
        'Dave',
        '$75.00'
      );

      expect(title).toBe('Payment Reminder');
      expect(body).toContain('Dave');
      expect(body).toContain('$75.00');
    });
  });
});

// ============================================
// Reminder Frequency Tests
// ============================================

describe('Reminder Frequency Types', () => {
  it('supports valid frequency values', () => {
    const validFrequencies: ReminderFrequency[] = ['once', 'daily', 'weekly'];

    for (const freq of validFrequencies) {
      expect(['once', 'daily', 'weekly']).toContain(freq);
    }
  });
});
