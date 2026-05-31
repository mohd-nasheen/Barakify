export type EntryType = "income" | "expense";

export interface Profile {
  id: string;
  email: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: EntryType;
  amount: number;
  category: string;
  notes: string | null;
  transaction_date: string;
  due_date: string | null;
  is_paid: boolean;
  paid_at: string | null;
  is_recurring: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: EntryType;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  created_at: string;
}
