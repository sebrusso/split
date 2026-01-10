import {
  generateShareCode,
  formatCurrency,
  formatRelativeDate,
  getInitials,
  calculateBalances,
  calculateBalancesWithSettlements,
  simplifyDebts,
} from "../lib/utils";

describe("generateShareCode", () => {
  it("should generate an 8-character code", async () => {
    const code = await generateShareCode();
    expect(code).toHaveLength(8);
  });

  it("should only contain valid characters (no confusing chars like 0, O, 1, I)", async () => {
    const validChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 20; i++) {
      const code = await generateShareCode();
      for (const char of code) {
        expect(validChars).toContain(char);
      }
    }
  });

  it("should generate unique codes (statistically)", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(await generateShareCode());
    }
    // With 32^8 possibilities, 20 codes should all be unique
    expect(codes.size).toBe(20);
  });
});

describe("formatCurrency", () => {
  it("should format USD correctly", () => {
    expect(formatCurrency(10, "USD")).toBe("$10.00");
    expect(formatCurrency(10.5, "USD")).toBe("$10.50");
    expect(formatCurrency(1000, "USD")).toBe("$1,000.00");
    expect(formatCurrency(0, "USD")).toBe("$0.00");
  });

  it("should format EUR correctly", () => {
    const result = formatCurrency(10, "EUR");
    expect(result).toContain("10.00");
  });

  it("should default to USD", () => {
    expect(formatCurrency(25)).toBe("$25.00");
  });

  it("should handle decimal precision", () => {
    expect(formatCurrency(10.999, "USD")).toBe("$11.00");
    expect(formatCurrency(10.994, "USD")).toBe("$10.99");
  });

  it("should handle large amounts", () => {
    expect(formatCurrency(1000000, "USD")).toBe("$1,000,000.00");
  });

  it("should handle negative amounts", () => {
    expect(formatCurrency(-50, "USD")).toBe("-$50.00");
  });
});

describe("formatRelativeDate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return "Today" for today\'s date', () => {
    const now = new Date("2025-01-05T12:00:00Z");
    jest.setSystemTime(now);
    expect(formatRelativeDate("2025-01-05T10:00:00Z")).toBe("Today");
  });

  it('should return "Yesterday" for yesterday\'s date', () => {
    const now = new Date("2025-01-05T12:00:00Z");
    jest.setSystemTime(now);
    expect(formatRelativeDate("2025-01-04T10:00:00Z")).toBe("Yesterday");
  });

  it('should return "X days ago" for dates within a week', () => {
    const now = new Date("2025-01-05T12:00:00Z");
    jest.setSystemTime(now);
    expect(formatRelativeDate("2025-01-03T10:00:00Z")).toBe("2 days ago");
    expect(formatRelativeDate("2025-01-01T10:00:00Z")).toBe("4 days ago");
  });

  it("should return formatted date for older dates", () => {
    const now = new Date("2025-01-15T12:00:00Z");
    jest.setSystemTime(now);
    const result = formatRelativeDate("2025-01-01T10:00:00Z");
    expect(result).toContain("Jan");
    expect(result).toContain("1");
  });
});

describe("getInitials", () => {
  it("should return first letter of single name", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  it("should return first letters of two names", () => {
    expect(getInitials("Alice Bob")).toBe("AB");
  });

  it("should return max 2 initials for longer names", () => {
    expect(getInitials("Alice Bob Charlie")).toBe("AB");
  });

  it("should handle lowercase names", () => {
    expect(getInitials("alice bob")).toBe("AB");
  });

  it("should handle single character name", () => {
    expect(getInitials("A")).toBe("A");
  });
});

describe("calculateBalances", () => {
  const members = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Charlie" },
  ];

  it("should return zero balances for no expenses", () => {
    const balances = calculateBalances([], members);
    expect(balances.get("1")).toBe(0);
    expect(balances.get("2")).toBe(0);
    expect(balances.get("3")).toBe(0);
  });

  it("should calculate balances for equal split", () => {
    // Alice pays $30, split equally 3 ways ($10 each)
    const expenses = [
      {
        paid_by: "1",
        amount: 30,
        splits: [
          { member_id: "1", amount: 10 },
          { member_id: "2", amount: 10 },
          { member_id: "3", amount: 10 },
        ],
      },
    ];

    const balances = calculateBalances(expenses, members);

    // Alice paid 30, owes 10, net = +20 (is owed $20)
    expect(balances.get("1")).toBe(20);
    // Bob paid 0, owes 10, net = -10 (owes $10)
    expect(balances.get("2")).toBe(-10);
    // Charlie paid 0, owes 10, net = -10 (owes $10)
    expect(balances.get("3")).toBe(-10);
  });

  it("should calculate balances for multiple expenses", () => {
    // Alice pays $30 (split 3 ways)
    // Bob pays $60 (split 3 ways)
    const expenses = [
      {
        paid_by: "1",
        amount: 30,
        splits: [
          { member_id: "1", amount: 10 },
          { member_id: "2", amount: 10 },
          { member_id: "3", amount: 10 },
        ],
      },
      {
        paid_by: "2",
        amount: 60,
        splits: [
          { member_id: "1", amount: 20 },
          { member_id: "2", amount: 20 },
          { member_id: "3", amount: 20 },
        ],
      },
    ];

    const balances = calculateBalances(expenses, members);

    // Alice: +30 - 10 - 20 = 0
    expect(balances.get("1")).toBe(0);
    // Bob: +60 - 10 - 20 = +30
    expect(balances.get("2")).toBe(30);
    // Charlie: 0 - 10 - 20 = -30
    expect(balances.get("3")).toBe(-30);
  });

  it("should handle unequal splits", () => {
    // Alice pays $100, Alice owes 50, Bob owes 30, Charlie owes 20
    const expenses = [
      {
        paid_by: "1",
        amount: 100,
        splits: [
          { member_id: "1", amount: 50 },
          { member_id: "2", amount: 30 },
          { member_id: "3", amount: 20 },
        ],
      },
    ];

    const balances = calculateBalances(expenses, members);

    expect(balances.get("1")).toBe(50); // +100 - 50
    expect(balances.get("2")).toBe(-30); // 0 - 30
    expect(balances.get("3")).toBe(-20); // 0 - 20
  });

  it("should handle partial splits (not all members)", () => {
    // Alice pays $20, only Bob is in the split
    const expenses = [
      {
        paid_by: "1",
        amount: 20,
        splits: [{ member_id: "2", amount: 20 }],
      },
    ];

    const balances = calculateBalances(expenses, members);

    expect(balances.get("1")).toBe(20); // Paid 20, owes nothing
    expect(balances.get("2")).toBe(-20); // Owes 20
    expect(balances.get("3")).toBe(0); // Not involved
  });
});

describe("calculateBalancesWithSettlements", () => {
  const members = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Charlie" },
  ];

  it("should return same as calculateBalances when no settlements", () => {
    const expenses = [
      {
        paid_by: "1",
        amount: 30,
        splits: [
          { member_id: "1", amount: 10 },
          { member_id: "2", amount: 10 },
          { member_id: "3", amount: 10 },
        ],
      },
    ];

    const balancesWithoutSettlements = calculateBalances(expenses, members);
    const balancesWithSettlements = calculateBalancesWithSettlements(
      expenses,
      [],
      members,
    );

    expect(balancesWithSettlements.get("1")).toBe(
      balancesWithoutSettlements.get("1"),
    );
    expect(balancesWithSettlements.get("2")).toBe(
      balancesWithoutSettlements.get("2"),
    );
    expect(balancesWithSettlements.get("3")).toBe(
      balancesWithoutSettlements.get("3"),
    );
  });

  it("should apply full settlement correctly", () => {
    // Alice pays $30, split 3 ways
    // Balances: Alice +20, Bob -10, Charlie -10
    const expenses = [
      {
        paid_by: "1",
        amount: 30,
        splits: [
          { member_id: "1", amount: 10 },
          { member_id: "2", amount: 10 },
          { member_id: "3", amount: 10 },
        ],
      },
    ];

    // Bob settles his $10 debt with Alice
    const settlements = [
      { from_member_id: "2", to_member_id: "1", amount: 10 },
    ];

    const balances = calculateBalancesWithSettlements(
      expenses,
      settlements,
      members,
    );

    // Alice: +20 - 10 (received) = +10
    expect(balances.get("1")).toBe(10);
    // Bob: -10 + 10 (paid) = 0
    expect(balances.get("2")).toBe(0);
    // Charlie: -10 (unchanged)
    expect(balances.get("3")).toBe(-10);
  });

  it("should apply partial settlement correctly", () => {
    // Alice pays $30, split 3 ways
    // Balances: Alice +20, Bob -10, Charlie -10
    const expenses = [
      {
        paid_by: "1",
        amount: 30,
        splits: [
          { member_id: "1", amount: 10 },
          { member_id: "2", amount: 10 },
          { member_id: "3", amount: 10 },
        ],
      },
    ];

    // Bob only pays $5 of his $10 debt
    const settlements = [
      { from_member_id: "2", to_member_id: "1", amount: 5 },
    ];

    const balances = calculateBalancesWithSettlements(
      expenses,
      settlements,
      members,
    );

    // Alice: +20 - 5 = +15
    expect(balances.get("1")).toBe(15);
    // Bob: -10 + 5 = -5
    expect(balances.get("2")).toBe(-5);
    // Charlie: -10 (unchanged)
    expect(balances.get("3")).toBe(-10);
  });

  it("should handle multiple settlements", () => {
    // Alice pays $30, split 3 ways
    // Balances: Alice +20, Bob -10, Charlie -10
    const expenses = [
      {
        paid_by: "1",
        amount: 30,
        splits: [
          { member_id: "1", amount: 10 },
          { member_id: "2", amount: 10 },
          { member_id: "3", amount: 10 },
        ],
      },
    ];

    // Both Bob and Charlie settle with Alice
    const settlements = [
      { from_member_id: "2", to_member_id: "1", amount: 10 },
      { from_member_id: "3", to_member_id: "1", amount: 10 },
    ];

    const balances = calculateBalancesWithSettlements(
      expenses,
      settlements,
      members,
    );

    // Everyone should be settled up
    expect(balances.get("1")).toBe(0);
    expect(balances.get("2")).toBe(0);
    expect(balances.get("3")).toBe(0);
  });

  it("should handle overpayment (creates reverse debt)", () => {
    // Alice pays $30, split 3 ways
    // Balances: Alice +20, Bob -10, Charlie -10
    const expenses = [
      {
        paid_by: "1",
        amount: 30,
        splits: [
          { member_id: "1", amount: 10 },
          { member_id: "2", amount: 10 },
          { member_id: "3", amount: 10 },
        ],
      },
    ];

    // Bob overpays by $5
    const settlements = [
      { from_member_id: "2", to_member_id: "1", amount: 15 },
    ];

    const balances = calculateBalancesWithSettlements(
      expenses,
      settlements,
      members,
    );

    // Alice: +20 - 15 = +5
    expect(balances.get("1")).toBe(5);
    // Bob: -10 + 15 = +5 (now Alice owes Bob!)
    expect(balances.get("2")).toBe(5);
    // Charlie: -10 (unchanged)
    expect(balances.get("3")).toBe(-10);
  });

  it("should handle settlements with no expenses", () => {
    // No expenses, just a settlement (prepayment scenario)
    const settlements = [
      { from_member_id: "2", to_member_id: "1", amount: 50 },
    ];

    const balances = calculateBalancesWithSettlements([], settlements, members);

    // Alice: 0 - 50 = -50 (now owes Bob)
    expect(balances.get("1")).toBe(-50);
    // Bob: 0 + 50 = +50 (is owed by Alice)
    expect(balances.get("2")).toBe(50);
    // Charlie: 0
    expect(balances.get("3")).toBe(0);
  });

  it("should handle multiple settlements between same members", () => {
    // Alice pays $60, split 3 ways
    // Balances: Alice +40, Bob -20, Charlie -20
    const expenses = [
      {
        paid_by: "1",
        amount: 60,
        splits: [
          { member_id: "1", amount: 20 },
          { member_id: "2", amount: 20 },
          { member_id: "3", amount: 20 },
        ],
      },
    ];

    // Bob makes multiple partial settlements to Alice
    const settlements = [
      { from_member_id: "2", to_member_id: "1", amount: 5 },
      { from_member_id: "2", to_member_id: "1", amount: 8 },
      { from_member_id: "2", to_member_id: "1", amount: 7 },
    ];

    const balances = calculateBalancesWithSettlements(
      expenses,
      settlements,
      members,
    );

    // Alice: +40 - 5 - 8 - 7 = +20
    expect(balances.get("1")).toBe(20);
    // Bob: -20 + 5 + 8 + 7 = 0
    expect(balances.get("2")).toBe(0);
    // Charlie: -20 (unchanged)
    expect(balances.get("3")).toBe(-20);
  });

  it("should handle bidirectional settlements between members", () => {
    // Complex scenario: Bob initially owes Alice, then Alice owes Bob
    const expenses = [
      {
        paid_by: "1", // Alice pays
        amount: 30,
        splits: [
          { member_id: "1", amount: 10 },
          { member_id: "2", amount: 10 },
          { member_id: "3", amount: 10 },
        ],
      },
      {
        paid_by: "2", // Bob pays
        amount: 60,
        splits: [
          { member_id: "1", amount: 20 },
          { member_id: "2", amount: 20 },
          { member_id: "3", amount: 20 },
        ],
      },
    ];

    // Initial balances: Alice: +30-10-20=0, Bob: +60-10-20=+30, Charlie: -10-20=-30
    // Bob is owed $30, Charlie owes $30

    // Both directions of settlement between Alice and Bob
    const settlements = [
      { from_member_id: "2", to_member_id: "1", amount: 15 }, // Bob pays Alice
      { from_member_id: "1", to_member_id: "2", amount: 10 }, // Alice pays Bob
    ];

    const balances = calculateBalancesWithSettlements(
      expenses,
      settlements,
      members,
    );

    // Alice: 0 - 15 + 10 = -5
    expect(balances.get("1")).toBe(-5);
    // Bob: +30 + 15 - 10 = +35
    expect(balances.get("2")).toBe(35);
    // Charlie: -30 (unchanged)
    expect(balances.get("3")).toBe(-30);
  });

  it("should handle settlements with decimal amounts", () => {
    const expenses = [
      {
        paid_by: "1",
        amount: 100,
        splits: [
          { member_id: "1", amount: 33.33 },
          { member_id: "2", amount: 33.33 },
          { member_id: "3", amount: 33.34 },
        ],
      },
    ];

    // Bob settles with partial decimal amount
    const settlements = [
      { from_member_id: "2", to_member_id: "1", amount: 16.665 },
    ];

    const balances = calculateBalancesWithSettlements(
      expenses,
      settlements,
      members,
    );

    // Alice: +100 - 33.33 - 16.665 = 49.995
    expect(balances.get("1")).toBeCloseTo(50.005, 2);
    // Bob: -33.33 + 16.665 = -16.665
    expect(balances.get("2")).toBeCloseTo(-16.665, 2);
    // Charlie: -33.34 (unchanged)
    expect(balances.get("3")).toBeCloseTo(-33.34, 2);
  });
});

describe("simplifyDebts", () => {
  const members = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Charlie" },
  ];

  it("should return no settlements when all balances are zero", () => {
    const balances = new Map([
      ["1", 0],
      ["2", 0],
      ["3", 0],
    ]);
    const settlements = simplifyDebts(balances, members);
    expect(settlements).toHaveLength(0);
  });

  it("should create simple settlement between two people", () => {
    // Alice is owed $20, Bob owes $20
    const balances = new Map([
      ["1", 20],
      ["2", -20],
      ["3", 0],
    ]);
    const settlements = simplifyDebts(balances, members);

    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      from: "2",
      to: "1",
      amount: 20,
    });
  });

  it("should simplify multiple debts", () => {
    // Alice is owed $20, Bob owes $10, Charlie owes $10
    const balances = new Map([
      ["1", 20],
      ["2", -10],
      ["3", -10],
    ]);
    const settlements = simplifyDebts(balances, members);

    expect(settlements).toHaveLength(2);

    // Both Bob and Charlie should pay Alice
    const totalToAlice = settlements
      .filter((s) => s.to === "1")
      .reduce((sum, s) => sum + s.amount, 0);
    expect(totalToAlice).toBe(20);
  });

  it("should handle complex multi-party debts", () => {
    // Alice is owed $30, Bob is owed $10, Charlie owes $40
    const balances = new Map([
      ["1", 30],
      ["2", 10],
      ["3", -40],
    ]);
    const settlements = simplifyDebts(balances, members);

    // Total amount settled should equal total owed
    const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);
    expect(totalSettled).toBe(40);

    // Charlie should be paying
    settlements.forEach((s) => {
      expect(s.from).toBe("3");
    });
  });

  it("should round amounts to 2 decimal places", () => {
    const balances = new Map([
      ["1", 10.333],
      ["2", -10.333],
    ]);
    const settlements = simplifyDebts(balances, members);

    expect(settlements[0].amount).toBe(10.33);
  });

  it("should ignore very small balances (< $0.01)", () => {
    const balances = new Map([
      ["1", 0.005],
      ["2", -0.005],
    ]);
    const settlements = simplifyDebts(balances, members);
    expect(settlements).toHaveLength(0);
  });
});

describe("Edge Cases", () => {
  it("should handle expense where payer is not in split", () => {
    const members = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];

    // Alice pays for Bob's expense entirely
    const expenses = [
      {
        paid_by: "1",
        amount: 50,
        splits: [{ member_id: "2", amount: 50 }],
      },
    ];

    const balances = calculateBalances(expenses, members);
    expect(balances.get("1")).toBe(50); // Is owed 50
    expect(balances.get("2")).toBe(-50); // Owes 50
  });

  it("should handle very large amounts", () => {
    const members = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];

    const expenses = [
      {
        paid_by: "1",
        amount: 1000000,
        splits: [
          { member_id: "1", amount: 500000 },
          { member_id: "2", amount: 500000 },
        ],
      },
    ];

    const balances = calculateBalances(expenses, members);
    expect(balances.get("1")).toBe(500000);
    expect(balances.get("2")).toBe(-500000);
  });

  it("should handle many members", () => {
    const members = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      name: `Person${i + 1}`,
    }));

    // Person 1 pays $200, split 20 ways ($10 each)
    const expenses = [
      {
        paid_by: "1",
        amount: 200,
        splits: members.map((m) => ({ member_id: m.id, amount: 10 })),
      },
    ];

    const balances = calculateBalances(expenses, members);

    // Person 1: +200 - 10 = +190
    expect(balances.get("1")).toBe(190);

    // Everyone else: -10
    for (let i = 2; i <= 20; i++) {
      expect(balances.get(String(i))).toBe(-10);
    }
  });
});
