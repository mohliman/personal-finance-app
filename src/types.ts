export interface Transaction {
  id?: string;
  avatar: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  recurring: boolean;
}
export interface Budget {
  id: string;
  category: string;
  maximum: number;
  theme: string;
}
export interface Pot {
  id: string;
  name: string;
  target: number;
  total: number;
  theme: string;
}
export interface FinanceState {
  balance: { current: number; income: number; expenses: number };
  budgets: Budget[];
  pots: Pot[];
}
export type SortOrder =
  "Latest" | "Oldest" | "A to Z" | "Z to A" | "Highest" | "Lowest";
export interface Bill extends Transaction {
  day: number;
  status: "paid" | "due" | "upcoming";
}
export type Action =
  | { type: "save-budget"; budget: Budget }
  | { type: "delete-budget"; id: string }
  | { type: "save-pot"; pot: Pot }
  | { type: "delete-pot"; id: string }
  | {
      type: "transfer";
      id: string;
      amount: number;
      direction: "add" | "withdraw";
    };
