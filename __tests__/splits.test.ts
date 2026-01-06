import {
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentSplit,
  calculateSharesSplit,
  calculateSplits,
  validateSplitData,
  getSplitMethodLabel,
  getSplitMethodDescription,
  getSplitMethodIcon,
} from "../lib/splits";

describe("calculateEqualSplit", () => {
  it("should split equally among all members", () => {
    const result = calculateEqualSplit(100, ["1", "2", "3", "4"]);

    expect(result).toHaveLength(4);
    expect(result[0].amount).toBe(25);
    expect(result[1].amount).toBe(25);
    expect(result[2].amount).toBe(25);
    expect(result[3].amount).toBe(25);
  });

  it("should handle uneven splits with rounding", () => {
    const result = calculateEqualSplit(100, ["1", "2", "3"]);

    expect(result).toHaveLength(3);
    // 100 / 3 = 33.33... per person
    // Should round and adjust last person for rounding errors
    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(100);
  });

  it("should return empty array for no members", () => {
    const result = calculateEqualSplit(100, []);
    expect(result).toHaveLength(0);
  });

  it("should handle single member", () => {
    const result = calculateEqualSplit(50, ["1"]);

    expect(result).toHaveLength(1);
    expect(result[0].member_id).toBe("1");
    expect(result[0].amount).toBe(50);
  });

  it("should handle small amounts with many members", () => {
    const result = calculateEqualSplit(1, ["1", "2", "3"]);

    expect(result).toHaveLength(3);
    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(1);
  });

  it("should handle $0 amount", () => {
    const result = calculateEqualSplit(0, ["1", "2"]);

    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(0);
    expect(result[1].amount).toBe(0);
  });
});

describe("calculateExactSplit", () => {
  it("should create splits with exact amounts", () => {
    const result = calculateExactSplit({
      "1": 30,
      "2": 50,
      "3": 20,
    });

    expect(result).toHaveLength(3);
    expect(result.find((s) => s.member_id === "1")?.amount).toBe(30);
    expect(result.find((s) => s.member_id === "2")?.amount).toBe(50);
    expect(result.find((s) => s.member_id === "3")?.amount).toBe(20);
  });

  it("should filter out zero amounts", () => {
    const result = calculateExactSplit({
      "1": 50,
      "2": 0,
      "3": 50,
    });

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.member_id === "2")).toBeUndefined();
  });

  it("should round to 2 decimal places", () => {
    const result = calculateExactSplit({
      "1": 33.333,
      "2": 33.333,
      "3": 33.334,
    });

    expect(result[0].amount).toBe(33.33);
    expect(result[1].amount).toBe(33.33);
    expect(result[2].amount).toBe(33.33);
  });

  it("should handle empty amounts", () => {
    const result = calculateExactSplit({});
    expect(result).toHaveLength(0);
  });
});

describe("calculatePercentSplit", () => {
  it("should split by percentages", () => {
    const result = calculatePercentSplit(100, {
      "1": 50,
      "2": 30,
      "3": 20,
    });

    expect(result).toHaveLength(3);
    expect(result.find((s) => s.member_id === "1")?.amount).toBe(50);
    expect(result.find((s) => s.member_id === "2")?.amount).toBe(30);
    expect(result.find((s) => s.member_id === "3")?.amount).toBe(20);
  });

  it("should handle decimal percentages", () => {
    const result = calculatePercentSplit(100, {
      "1": 33.33,
      "2": 33.33,
      "3": 33.34,
    });

    expect(result).toHaveLength(3);
    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(100);
  });

  it("should filter out zero percentages", () => {
    const result = calculatePercentSplit(100, {
      "1": 100,
      "2": 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].member_id).toBe("1");
    expect(result[0].amount).toBe(100);
  });

  it("should handle large amounts", () => {
    const result = calculatePercentSplit(10000, {
      "1": 25,
      "2": 75,
    });

    expect(result.find((s) => s.member_id === "1")?.amount).toBe(2500);
    expect(result.find((s) => s.member_id === "2")?.amount).toBe(7500);
  });
});

describe("calculateSharesSplit", () => {
  it("should split proportionally by shares", () => {
    const result = calculateSharesSplit(100, {
      "1": 1,
      "2": 1,
      "3": 1,
      "4": 1,
    });

    expect(result).toHaveLength(4);
    const amounts = result.map((s) => s.amount);
    // Should be 25 each (100 / 4 shares)
    amounts.forEach((amount) => {
      expect(amount).toBe(25);
    });
  });

  it("should handle unequal shares", () => {
    const result = calculateSharesSplit(100, {
      "1": 2, // Should get 50
      "2": 1, // Should get 25
      "3": 1, // Should get 25
    });

    expect(result.find((s) => s.member_id === "1")?.amount).toBe(50);
    expect(result.find((s) => s.member_id === "2")?.amount).toBe(25);
    expect(result.find((s) => s.member_id === "3")?.amount).toBe(25);
  });

  it("should filter out zero shares", () => {
    const result = calculateSharesSplit(100, {
      "1": 1,
      "2": 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].member_id).toBe("1");
    expect(result[0].amount).toBe(100);
  });

  it("should return empty array for zero total shares", () => {
    const result = calculateSharesSplit(100, {
      "1": 0,
      "2": 0,
    });

    expect(result).toHaveLength(0);
  });

  it("should handle complex share ratios", () => {
    const result = calculateSharesSplit(120, {
      "1": 3, // 3/6 = 50% = 60
      "2": 2, // 2/6 = 33.33% = 40
      "3": 1, // 1/6 = 16.67% = 20
    });

    expect(result.find((s) => s.member_id === "1")?.amount).toBe(60);
    expect(result.find((s) => s.member_id === "2")?.amount).toBe(40);
    expect(result.find((s) => s.member_id === "3")?.amount).toBe(20);
  });
});

describe("calculateSplits (unified function)", () => {
  it("should delegate to equal split", () => {
    const result = calculateSplits("equal", 100, {
      memberIds: ["1", "2"],
    });

    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(50);
  });

  it("should delegate to exact split", () => {
    const result = calculateSplits("exact", 100, {
      amounts: { "1": 60, "2": 40 },
    });

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.member_id === "1")?.amount).toBe(60);
  });

  it("should delegate to percent split", () => {
    const result = calculateSplits("percent", 200, {
      percents: { "1": 75, "2": 25 },
    });

    expect(result.find((s) => s.member_id === "1")?.amount).toBe(150);
    expect(result.find((s) => s.member_id === "2")?.amount).toBe(50);
  });

  it("should delegate to shares split", () => {
    const result = calculateSplits("shares", 100, {
      shares: { "1": 1, "2": 3 },
    });

    expect(result.find((s) => s.member_id === "1")?.amount).toBe(25);
    expect(result.find((s) => s.member_id === "2")?.amount).toBe(75);
  });

  it("should return empty for unknown method", () => {
    const result = calculateSplits("unknown" as any, 100, {});
    expect(result).toHaveLength(0);
  });
});

describe("validateSplitData", () => {
  describe("equal split", () => {
    it("should be valid with at least one member", () => {
      const result = validateSplitData("equal", 100, {
        memberIds: ["1", "2"],
      });

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should be invalid with no members", () => {
      const result = validateSplitData("equal", 100, {
        memberIds: [],
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("at least one person");
    });
  });

  describe("exact split", () => {
    it("should be valid when amounts equal total", () => {
      const result = validateSplitData("exact", 100, {
        amounts: { "1": 60, "2": 40 },
      });

      expect(result.isValid).toBe(true);
    });

    it("should be invalid when amounts don't add up", () => {
      const result = validateSplitData("exact", 100, {
        amounts: { "1": 30, "2": 30 },
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("add up to");
    });

    it("should handle small rounding differences", () => {
      const result = validateSplitData("exact", 100, {
        amounts: { "1": 33.33, "2": 33.33, "3": 33.34 },
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe("percent split", () => {
    it("should be valid when percentages equal 100", () => {
      const result = validateSplitData("percent", 100, {
        percents: { "1": 50, "2": 50 },
      });

      expect(result.isValid).toBe(true);
    });

    it("should be invalid when percentages don't add to 100", () => {
      const result = validateSplitData("percent", 100, {
        percents: { "1": 30, "2": 30 },
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("100%");
    });

    it("should handle small rounding differences", () => {
      const result = validateSplitData("percent", 100, {
        percents: { "1": 33.33, "2": 33.33, "3": 33.34 },
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe("shares split", () => {
    it("should be valid with at least one share", () => {
      const result = validateSplitData("shares", 100, {
        shares: { "1": 1, "2": 0 },
      });

      expect(result.isValid).toBe(true);
    });

    it("should be invalid with zero total shares", () => {
      const result = validateSplitData("shares", 100, {
        shares: { "1": 0, "2": 0 },
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("at least one share");
    });
  });
});

describe("Helper functions", () => {
  describe("getSplitMethodLabel", () => {
    it("should return correct labels", () => {
      expect(getSplitMethodLabel("equal")).toBe("Split Equally");
      expect(getSplitMethodLabel("exact")).toBe("Exact Amounts");
      expect(getSplitMethodLabel("percent")).toBe("By Percentage");
      expect(getSplitMethodLabel("shares")).toBe("By Shares");
    });

    it("should handle unknown method", () => {
      expect(getSplitMethodLabel("unknown" as any)).toBe("Unknown");
    });
  });

  describe("getSplitMethodDescription", () => {
    it("should return correct descriptions", () => {
      expect(getSplitMethodDescription("equal")).toContain("same amount");
      expect(getSplitMethodDescription("exact")).toContain("specific amounts");
      expect(getSplitMethodDescription("percent")).toContain("percentage");
      expect(getSplitMethodDescription("shares")).toContain("shares");
    });
  });

  describe("getSplitMethodIcon", () => {
    it("should return correct icons", () => {
      expect(getSplitMethodIcon("equal")).toBe("=");
      expect(getSplitMethodIcon("exact")).toBe("$");
      expect(getSplitMethodIcon("percent")).toBe("%");
      expect(getSplitMethodIcon("shares")).toBe("#");
    });
  });
});

describe("Edge Cases", () => {
  it("should handle very small amounts", () => {
    const result = calculateEqualSplit(0.03, ["1", "2", "3"]);

    expect(result).toHaveLength(3);
    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(0.03);
  });

  it("should handle very large amounts", () => {
    const result = calculateEqualSplit(999999.99, ["1", "2"]);

    expect(result[0].amount).toBeCloseTo(499999.995, 1);
    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(999999.99);
  });

  it("should handle many decimal places in input", () => {
    const result = calculatePercentSplit(100.999999, {
      "1": 33.333333,
      "2": 33.333333,
      "3": 33.333334,
    });

    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(Math.abs(total - 100.999999)).toBeLessThan(0.02);
  });

  it("should handle single share among many members", () => {
    const shares: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) {
      shares[String(i)] = i === 1 ? 1 : 0;
    }

    const result = calculateSharesSplit(100, shares);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(100);
  });
});
