export interface Group {
  id: string;
  name: string;
  emoji: string;
  currency: string;
  share_code: string;
  created_at: string;
}

export interface Member {
  id: string;
  group_id: string;
  name: string;
  user_id: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  created_at: string;
  // Joined fields
  payer?: Member;
  splits?: Split[];
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
