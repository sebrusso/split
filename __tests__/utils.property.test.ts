/**
 * Property-Based Tests for Core Balance Logic
 *
 * Uses fast-check to verify mathematical invariants of the
 * calculateBalances and simplifyDebts functions.
 */

import * as fc from "fast-check";
import { calculateBalances, simplifyDebts } from "../lib/utils";

// ============================================
// Test Arbitraries (Data Generators)
// ============================================

// Generate a valid member
const memberArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
});

// Generate a list of unique members
const membersArbitrary = fc
  .array(memberArbitrary, { minLength: 2, maxLength: 8 })
  .map((members) => {
    // Ensure unique IDs
    const seen = new Set<string>();
    return members.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  })
  .filter((members) => members.length >= 2);

// Generate a valid expense for given member IDs
const expenseArbitrary = (memberIds: string[]) =>
  fc.record({
    paid_by: fc.constantFrom(...memberIds),
    amount: fc.double({ min: 0.01, max: 1000, noNaN: true }),
    splits: fc
      .array(
        fc.record({
          member_id: fc.constantFrom(...memberIds),
          amount: fc.double({ min: 0, max: 1000, noNaN: true }),
        }),
        { minLength: 1, maxLength: memberIds.length }
      )
      .map((splits) => {
        // Make splits unique by member_id
        const seen = new Set<string>();
        return splits.filter((s) => {
          if (seen.has(s.member_id)) return false;
          seen.add(s.member_id);
          return true;
        });
      }),
    currency: fc.constant(null),
    exchange_rate: fc.constant(null),
  });

// ============================================
// Property Tests: calculateBalances
// ============================================

describe("Property Tests: calculateBalances", () => {
  it("should always have balances sum to approximately zero (conservation of money)", () => {
    // Use a simpler approach without nested properties
    fc.assert(
      fc.property(membersArbitrary, (members) => {
        // Generate expenses inline
        const memberIds = members.map((m) => m.id);
        const numExpenses = Math.floor(Math.random() * 5) + 1;

        const expenses = Array.from({ length: numExpenses }, () => {
          const payerId = memberIds[Math.floor(Math.random() * memberIds.length)];
          const amount = Math.random() * 500 + 10;
          const splitAmount = amount / members.length;

          return {
            paid_by: payerId,
            amount,
            splits: members.map((m) => ({
              member_id: m.id,
              amount: splitAmount,
            })),
            currency: null as null,
            exchange_rate: null as null,
          };
        });

        const balances = calculateBalances(expenses, members);
        const total = Array.from(balances.values()).reduce(
          (sum, b) => sum + b,
          0
        );

        // Balances should sum to approximately zero (floating point tolerance)
        return Math.abs(total) < 0.01;
      }),
      { numRuns: 50 }
    );
  });

  it("should be idempotent - same inputs always produce same outputs", () => {
    fc.assert(
      fc.property(membersArbitrary, (members) => {
        // Generate consistent test expenses
        const memberIds = members.map((m) => m.id);
        const expenses = [
          {
            paid_by: memberIds[0],
            amount: 100,
            splits: members.map((m) => ({
              member_id: m.id,
              amount: 100 / members.length,
            })),
            currency: null as null,
            exchange_rate: null as null,
          },
        ];

        const balances1 = calculateBalances(expenses, members);
        const balances2 = calculateBalances(expenses, members);

        // Maps should have same size
        if (balances1.size !== balances2.size) return false;

        // All entries should match
        for (const [key, value] of balances1.entries()) {
          if (balances2.get(key) !== value) return false;
        }

        return true;
      }),
      { numRuns: 30 }
    );
  });

  it("should initialize all members with zero balance when no expenses", () => {
    fc.assert(
      fc.property(membersArbitrary, (members) => {
        const balances = calculateBalances([], members);

        // All members should have balance of 0
        return (
          balances.size === members.length &&
          Array.from(balances.values()).every((b) => b === 0)
        );
      }),
      { numRuns: 30 }
    );
  });

  it("should credit payer the full expense amount", () => {
    fc.assert(
      fc.property(membersArbitrary, (members) => {
        const payer = members[0];
        const amount = 100;
        const expenses = [
          {
            paid_by: payer.id,
            amount,
            splits: members.map((m) => ({
              member_id: m.id,
              amount: amount / members.length,
            })),
            currency: null,
            exchange_rate: null,
          },
        ];

        const balances = calculateBalances(expenses, members);
        const payerBalance = balances.get(payer.id) || 0;

        // Payer should be credited amount minus their split
        const expectedPayerBalance = amount - amount / members.length;
        return Math.abs(payerBalance - expectedPayerBalance) < 0.01;
      }),
      { numRuns: 30 }
    );
  });
});

// ============================================
// Property Tests: simplifyDebts
// ============================================

describe("Property Tests: simplifyDebts", () => {
  it("should never produce more than (n-1) settlements for n members", () => {
    fc.assert(
      fc.property(membersArbitrary, (members) => {
        // Generate random balances that sum to zero
        const n = members.length;
        const randomAmounts = Array.from({ length: n - 1 }, () =>
          (Math.random() - 0.5) * 200
        );
        const lastAmount = -randomAmounts.reduce((a, b) => a + b, 0);
        randomAmounts.push(lastAmount);

        const balances = new Map<string, number>();
        members.forEach((m, i) => {
          balances.set(m.id, randomAmounts[i]);
        });

        const settlements = simplifyDebts(balances, members);

        // Number of settlements should be at most n-1
        return settlements.length <= members.length - 1;
      }),
      { numRuns: 50 }
    );
  });

  it("should settle all debts completely", () => {
    fc.assert(
      fc.property(membersArbitrary, (members) => {
        // Generate balances that sum to zero
        const n = members.length;
        const amounts: number[] = [];
        let runningSum = 0;

        for (let i = 0; i < n - 1; i++) {
          const amount = (Math.random() - 0.5) * 200;
          amounts.push(amount);
          runningSum += amount;
        }
        amounts.push(-runningSum); // Last amount ensures sum is zero

        const balances = new Map<string, number>();
        members.forEach((m, i) => {
          balances.set(m.id, amounts[i]);
        });

        const settlements = simplifyDebts(balances, members);

        // Apply settlements
        const newBalances = new Map(balances);
        settlements.forEach((s) => {
          newBalances.set(s.from, (newBalances.get(s.from) || 0) + s.amount);
          newBalances.set(s.to, (newBalances.get(s.to) || 0) - s.amount);
        });

        // All balances should be near zero after settlements
        return Array.from(newBalances.values()).every(
          (b) => Math.abs(b) < 0.02
        );
      }),
      { numRuns: 50 }
    );
  });

  it("should return empty array when all balances are zero", () => {
    fc.assert(
      fc.property(membersArbitrary, (members) => {
        const balances = new Map<string, number>();
        members.forEach((m) => balances.set(m.id, 0));

        const settlements = simplifyDebts(balances, members);
        return settlements.length === 0;
      }),
      { numRuns: 30 }
    );
  });

  it("should produce positive settlement amounts only", () => {
    fc.assert(
      fc.property(membersArbitrary, (members) => {
        // Generate non-zero balances
        const amounts = members.map((_, i) =>
          i === 0 ? 100 : i === 1 ? -100 : 0
        );

        const balances = new Map<string, number>();
        members.forEach((m, i) => balances.set(m.id, amounts[i]));

        const settlements = simplifyDebts(balances, members);

        // All settlement amounts should be positive
        return settlements.every((s) => s.amount > 0);
      }),
      { numRuns: 30 }
    );
  });

  it("should have valid from/to member IDs", () => {
    fc.assert(
      fc.property(membersArbitrary, (members) => {
        const memberIds = new Set(members.map((m) => m.id));

        const amounts = members.map((_, i) =>
          i === 0 ? 50 : i === 1 ? -50 : 0
        );

        const balances = new Map<string, number>();
        members.forEach((m, i) => balances.set(m.id, amounts[i]));

        const settlements = simplifyDebts(balances, members);

        // All from/to IDs should be valid member IDs
        return settlements.every(
          (s) => memberIds.has(s.from) && memberIds.has(s.to) && s.from !== s.to
        );
      }),
      { numRuns: 30 }
    );
  });
});

// ============================================
// Integrated Property Tests
// ============================================

describe("Integrated Property Tests: Full Flow", () => {
  it("should produce correct settlements from expense calculation", () => {
    fc.assert(
      fc.property(membersArbitrary, (members) => {
        // Simple scenario: first member pays for everyone
        const totalAmount = 100;
        const splitAmount = totalAmount / members.length;

        const expenses = [
          {
            paid_by: members[0].id,
            amount: totalAmount,
            splits: members.map((m) => ({
              member_id: m.id,
              amount: splitAmount,
            })),
            currency: null as null,
            exchange_rate: null as null,
          },
        ];

        const balances = calculateBalances(expenses, members);
        const settlements = simplifyDebts(balances, members);

        // Verify the flow
        // 1. Payer should have positive balance (owed money)
        const payerBalance = balances.get(members[0].id) || 0;
        const expectedPayerBalance = totalAmount - splitAmount;
        if (Math.abs(payerBalance - expectedPayerBalance) > 0.01) return false;

        // 2. Total settlements should approximately equal total debt
        // (with floating point tolerance due to rounding in simplifyDebts)
        const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);
        const expectedTotal = (members.length - 1) * splitAmount;
        // Use larger tolerance for rounding effects with many members
        return Math.abs(totalSettled - expectedTotal) < 0.1 * members.length;
      }),
      { numRuns: 30 }
    );
  });
});
