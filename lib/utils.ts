export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function calculateBalances(
  expenses: Array<{ paid_by: string; amount: number; splits: Array<{ member_id: string; amount: number }> }>,
  members: Array<{ id: string; name: string }>
): Map<string, number> {
  const balances = new Map<string, number>();

  // Initialize all members with 0 balance
  members.forEach(m => balances.set(m.id, 0));

  expenses.forEach(exp => {
    // Payer gets credited full amount
    const currentPayerBalance = balances.get(exp.paid_by) || 0;
    balances.set(exp.paid_by, currentPayerBalance + exp.amount);

    // Each person in split gets debited their share
    exp.splits.forEach(split => {
      const currentBalance = balances.get(split.member_id) || 0;
      balances.set(split.member_id, currentBalance - split.amount);
    });
  });

  return balances;
}

export function simplifyDebts(
  balances: Map<string, number>,
  members: Array<{ id: string; name: string }>
): Array<{ from: string; to: string; amount: number }> {
  const settlements: Array<{ from: string; to: string; amount: number }> = [];

  // Separate debtors and creditors
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  balances.forEach((balance, memberId) => {
    if (balance < -0.01) {
      debtors.push({ id: memberId, amount: Math.abs(balance) });
    } else if (balance > 0.01) {
      creditors.push({ id: memberId, amount: balance });
    }
  });

  // Sort by amount (descending)
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // Match debtors with creditors
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debt = debtors[i];
    const credit = creditors[j];
    const amount = Math.min(debt.amount, credit.amount);

    if (amount > 0.01) {
      settlements.push({
        from: debt.id,
        to: credit.id,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debt.amount -= amount;
    credit.amount -= amount;

    if (debt.amount < 0.01) i++;
    if (credit.amount < 0.01) j++;
  }

  return settlements;
}
