export type TxType = "expense" | "income";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  createdAt: number;
  recurringId?: string;
}

export interface Recurring {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  /** 1–28, the day each month this posts */
  dayOfMonth: number;
  active: boolean;
  /** Last month posted, YYYY-MM */
  lastPosted?: string;
  createdAt: number;
}

export interface Settings {
  displayName?: string;
  /** Overall spending limit per month */
  monthlyBudget?: number;
  /** Per-category monthly limits */
  budgets: Record<string, number>;
  currency: string;
  /** Set once the old v1 data has been imported */
  legacyImported?: boolean;
}

export const DEFAULT_SETTINGS: Settings = { budgets: {}, currency: "LKR" };
