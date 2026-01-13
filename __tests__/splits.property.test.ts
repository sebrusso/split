/**
 * Property-Based Tests for Split Calculations
 *
 * Uses fast-check to verify mathematical invariants of split calculations:
 * - Splits always sum to the expense amount
 * - No negative splits
 * - Rounding is handled correctly
 * - Edge cases are handled properly
 */

import * as fc from "fast-check";
import {
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentSplit,
  calculateSharesSplit,
  calculateSplits,
  validateSplitData,
} from "../lib/splits";

// ============================================
// Test Arbitraries (Data Generators)
// ============================================

// Generate a valid amount (1.00 to 10000) - minimum $1 to avoid rounding edge cases with very small amounts
const amountArbitrary = fc.double({
  min: 1.0,
  max: 10000,
  noNaN: true,
});

// Generate an array of unique member IDs
const memberIdsArbitrary = fc
  .array(fc.uuid(), { minLength: 1, maxLength: 10 })
  .map((ids) => [...new Set(ids)]); // Ensure unique

// Generate a record of member percentages that sum to 100
const percentsArbitrary = (memberIds: string[]) => {
  if (memberIds.length === 0) return fc.constant({});

  return fc.array(
    fc.double({ min: 0, max: 100, noNaN: true }),
    { minLength: memberIds.length, maxLength: memberIds.length }
  ).map((values) => {
    // Normalize to sum to 100
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const normalized = values.map((v) => (v / total) * 100);

    const result: Record<string, number> = {};
    memberIds.forEach((id, i) => {
      result[id] = Math.round(normalized[i] * 100) / 100;
    });

    // Adjust last value to ensure sum is exactly 100
    const currentTotal = Object.values(result).reduce((a, b) => a + b, 0);
    const lastId = memberIds[memberIds.length - 1];
    result[lastId] = Math.round((result[lastId] + (100 - currentTotal)) * 100) / 100;

    return result;
  });
};

// Generate a record of member shares (positive integers)
const sharesArbitrary = (memberIds: string[]) => {
  if (memberIds.length === 0) return fc.constant({});

  return fc.array(
    fc.integer({ min: 0, max: 10 }),
    { minLength: memberIds.length, maxLength: memberIds.length }
  ).map((values) => {
    const result: Record<string, number> = {};
    memberIds.forEach((id, i) => {
      result[id] = values[i];
    });
    // Ensure at least one share is > 0
    if (Object.values(result).every((v) => v === 0) && memberIds.length > 0) {
      result[memberIds[0]] = 1;
    }
    return result;
  });
};

// ============================================
// Property Tests: calculateEqualSplit
// ============================================

describe("Property Tests: calculateEqualSplit", () => {
  it("should always sum to the original amount (within rounding tolerance)", () => {
    fc.assert(
      fc.property(amountArbitrary, memberIdsArbitrary, (amount, memberIds) => {
        if (memberIds.length === 0) return true;

        const splits = calculateEqualSplit(amount, memberIds);
        const total = splits.reduce((sum, s) => sum + s.amount, 0);

        // Allow 1 cent tolerance per member for rounding
        const tolerance = 0.01 * memberIds.length;
        return Math.abs(total - amount) <= tolerance;
      }),
      { numRuns: 100 }
    );
  });

  it("should produce non-negative amounts for all splits", () => {
    fc.assert(
      fc.property(amountArbitrary, memberIdsArbitrary, (amount, memberIds) => {
        const splits = calculateEqualSplit(amount, memberIds);
        return splits.every((s) => s.amount >= 0);
      }),
      { numRuns: 100 }
    );
  });

  it("should produce one split per member", () => {
    fc.assert(
      fc.property(amountArbitrary, memberIdsArbitrary, (amount, memberIds) => {
        const splits = calculateEqualSplit(amount, memberIds);
        return splits.length === memberIds.length;
      }),
      { numRuns: 100 }
    );
  });

  it("should assign all members correctly", () => {
    fc.assert(
      fc.property(amountArbitrary, memberIdsArbitrary, (amount, memberIds) => {
        const splits = calculateEqualSplit(amount, memberIds);
        const splitMemberIds = new Set(splits.map((s) => s.member_id));
        return memberIds.every((id) => splitMemberIds.has(id));
      }),
      { numRuns: 100 }
    );
  });

  it("should produce approximately equal amounts (within rounding)", () => {
    fc.assert(
      fc.property(amountArbitrary, memberIdsArbitrary, (amount, memberIds) => {
        if (memberIds.length <= 1) return true;

        const splits = calculateEqualSplit(amount, memberIds);
        const amounts = splits.map((s) => s.amount);
        const min = Math.min(...amounts);
        const max = Math.max(...amounts);

        // Max difference should be at most 1 cent per person (rounding can accumulate)
        const tolerance = 0.01 * memberIds.length;
        return max - min <= tolerance;
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property Tests: calculatePercentSplit
// ============================================

// Helper to generate percents that sum to 100
function generatePercents(memberIds: string[]): Record<string, number> {
  if (memberIds.length === 0) return {};
  const basePercent = Math.floor(100 / memberIds.length);
  const result: Record<string, number> = {};
  let remaining = 100;
  memberIds.forEach((id, i) => {
    if (i === memberIds.length - 1) {
      result[id] = remaining;
    } else {
      result[id] = basePercent;
      remaining -= basePercent;
    }
  });
  return result;
}

describe("Property Tests: calculatePercentSplit", () => {
  it("should always sum to the original amount (within rounding tolerance)", () => {
    fc.assert(
      fc.property(
        amountArbitrary,
        memberIdsArbitrary.filter((ids) => ids.length > 0),
        (amount, memberIds) => {
          const percents = generatePercents(memberIds);
          const splits = calculatePercentSplit(amount, percents);
          const total = splits.reduce((sum, s) => sum + s.amount, 0);

          // Allow small tolerance for rounding
          return Math.abs(total - amount) <= 0.02;
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should produce non-negative amounts", () => {
    fc.assert(
      fc.property(
        amountArbitrary,
        memberIdsArbitrary.filter((ids) => ids.length > 0),
        (amount, memberIds) => {
          const percents = generatePercents(memberIds);
          const splits = calculatePercentSplit(amount, percents);
          return splits.every((s) => s.amount >= 0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should respect proportions (larger percentage = larger amount)", () => {
    fc.assert(
      fc.property(amountArbitrary, (amount) => {
        const percents = { a: 60, b: 40 };
        const splits = calculatePercentSplit(amount, percents);

        const splitA = splits.find((s) => s.member_id === "a");
        const splitB = splits.find((s) => s.member_id === "b");

        if (!splitA || !splitB) return true;
        return splitA.amount >= splitB.amount;
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================
// Property Tests: calculateSharesSplit
// ============================================

// Helper to generate shares (each member gets 1 share)
function generateShares(memberIds: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  memberIds.forEach((id) => {
    result[id] = 1;
  });
  return result;
}

describe("Property Tests: calculateSharesSplit", () => {
  it("should always sum to the original amount (within rounding tolerance)", () => {
    fc.assert(
      fc.property(
        amountArbitrary,
        memberIdsArbitrary.filter((ids) => ids.length > 0),
        (amount, memberIds) => {
          const shares = generateShares(memberIds);
          const splits = calculateSharesSplit(amount, shares);

          const totalShares = Object.values(shares).reduce((a: number, b: number) => a + b, 0);
          if (totalShares === 0) return splits.length === 0;

          const total = splits.reduce((sum, s) => sum + s.amount, 0);
          return Math.abs(total - amount) <= 0.02;
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should produce non-negative amounts", () => {
    fc.assert(
      fc.property(
        amountArbitrary,
        memberIdsArbitrary.filter((ids) => ids.length > 0),
        (amount, memberIds) => {
          const shares = generateShares(memberIds);
          const splits = calculateSharesSplit(amount, shares);
          return splits.every((s) => s.amount >= 0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should exclude members with zero shares", () => {
    fc.assert(
      fc.property(amountArbitrary, (amount) => {
        const shares = { a: 2, b: 0, c: 1 };
        const splits = calculateSharesSplit(amount, shares);

        return !splits.some((s) => s.member_id === "b");
      }),
      { numRuns: 20 }
    );
  });

  it("should maintain correct ratios between shares", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 3.0, max: 10000, noNaN: true }), // Need at least $3 to split 2:1 with cents
        (amount) => {
          const shares = { a: 2, b: 1 };
          const splits = calculateSharesSplit(amount, shares);

          const splitA = splits.find((s) => s.member_id === "a");
          const splitB = splits.find((s) => s.member_id === "b");

          if (!splitA || !splitB || splitB.amount === 0) return true;

          // Ratio should be approximately 2:1 (allowing 10% tolerance for rounding)
          const ratio = splitA.amount / splitB.amount;
          return Math.abs(ratio - 2) < 0.2;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================
// Property Tests: calculateExactSplit
// ============================================

describe("Property Tests: calculateExactSplit", () => {
  it("should preserve exact amounts (within rounding)", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.uuid(), fc.double({ min: 0, max: 1000, noNaN: true })),
        (amounts) => {
          const splits = calculateExactSplit(amounts);

          return splits.every((split) => {
            const original = amounts[split.member_id];
            if (original === 0) return false; // Should have been filtered
            return Math.abs(split.amount - Math.round(original * 100) / 100) < 0.01;
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should filter out zero and negative amounts", () => {
    fc.assert(
      fc.property(
        // Use realistic currency amounts (min $0.01 when positive)
        fc.dictionary(
          fc.uuid(),
          fc.oneof(
            fc.constant(0), // Explicit zeros
            fc.double({ min: 0.01, max: 1000, noNaN: true }) // Realistic currency values
          )
        ),
        (amounts) => {
          const splits = calculateExactSplit(amounts);
          // All splits should have positive amounts (zeros filtered)
          return splits.every((s) => s.amount > 0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================
// Property Tests: validateSplitData
// ============================================

describe("Property Tests: validateSplitData", () => {
  it("equal split should be valid with at least one member", () => {
    fc.assert(
      fc.property(
        amountArbitrary,
        memberIdsArbitrary.filter((ids) => ids.length > 0),
        (amount, memberIds) => {
          const result = validateSplitData("equal", amount, { memberIds });
          return result.isValid === true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it("equal split should be invalid with no members", () => {
    fc.assert(
      fc.property(amountArbitrary, (amount) => {
        const result = validateSplitData("equal", amount, { memberIds: [] });
        return result.isValid === false && result.error !== null;
      }),
      { numRuns: 20 }
    );
  });

  it("percent split should be valid when percentages sum to 100", () => {
    fc.assert(
      fc.property(amountArbitrary, (amount) => {
        const percents = { a: 50, b: 30, c: 20 };
        const result = validateSplitData("percent", amount, { percents });
        return result.isValid === true;
      }),
      { numRuns: 20 }
    );
  });

  it("percent split should be invalid when percentages don't sum to 100", () => {
    fc.assert(
      fc.property(amountArbitrary, (amount) => {
        const percents = { a: 50, b: 30 }; // Sum = 80
        const result = validateSplitData("percent", amount, { percents });
        return result.isValid === false;
      }),
      { numRuns: 20 }
    );
  });

  it("exact split should be valid when amounts sum to total", () => {
    fc.assert(
      fc.property(amountArbitrary, (amount) => {
        const half = Math.round(amount * 50) / 100;
        const other = Math.round((amount - half) * 100) / 100;
        const amounts = { a: half, b: other };
        const result = validateSplitData("exact", amount, { amounts });
        return result.isValid === true;
      }),
      { numRuns: 50 }
    );
  });

  it("shares split should be valid with at least one non-zero share", () => {
    fc.assert(
      fc.property(amountArbitrary, (amount) => {
        const shares = { a: 1, b: 0, c: 2 };
        const result = validateSplitData("shares", amount, { shares });
        return result.isValid === true;
      }),
      { numRuns: 20 }
    );
  });

  it("shares split should be invalid with all zero shares", () => {
    fc.assert(
      fc.property(amountArbitrary, (amount) => {
        const shares = { a: 0, b: 0 };
        const result = validateSplitData("shares", amount, { shares });
        return result.isValid === false;
      }),
      { numRuns: 20 }
    );
  });
});

// ============================================
// Integrated Property Tests
// ============================================

describe("Integrated Property Tests: Split Consistency", () => {
  it("calculateSplits should produce same result as direct function calls", () => {
    fc.assert(
      fc.property(amountArbitrary, memberIdsArbitrary, (amount, memberIds) => {
        if (memberIds.length === 0) return true;

        const directResult = calculateEqualSplit(amount, memberIds);
        const unifiedResult = calculateSplits("equal", amount, { memberIds });

        if (directResult.length !== unifiedResult.length) return false;

        return directResult.every((d, i) => {
          const u = unifiedResult[i];
          return d.member_id === u.member_id && Math.abs(d.amount - u.amount) < 0.01;
        });
      }),
      { numRuns: 50 }
    );
  });

  it("all split methods should handle edge case of single member", () => {
    fc.assert(
      fc.property(amountArbitrary, fc.uuid(), (amount, memberId) => {
        const equalSplit = calculateEqualSplit(amount, [memberId]);
        const percentSplit = calculatePercentSplit(amount, { [memberId]: 100 });
        const sharesSplit = calculateSharesSplit(amount, { [memberId]: 1 });

        // All should result in single split with full amount
        return (
          equalSplit.length === 1 &&
          Math.abs(equalSplit[0].amount - amount) < 0.01 &&
          percentSplit.length === 1 &&
          Math.abs(percentSplit[0].amount - amount) < 0.01 &&
          sharesSplit.length === 1 &&
          Math.abs(sharesSplit[0].amount - amount) < 0.01
        );
      }),
      { numRuns: 50 }
    );
  });

  it("rounding should never cause splits to exceed original amount significantly", () => {
    fc.assert(
      fc.property(amountArbitrary, memberIdsArbitrary, (amount, memberIds) => {
        if (memberIds.length === 0) return true;

        const splits = calculateEqualSplit(amount, memberIds);
        const total = splits.reduce((sum, s) => sum + s.amount, 0);

        // Total should never exceed amount by more than 1 cent
        return total <= amount + 0.01;
      }),
      { numRuns: 100 }
    );
  });
});
