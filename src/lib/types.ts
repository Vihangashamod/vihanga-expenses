export type TxType = "expense" | "income" | "transfer";
export type CatType = "expense" | "income";

export interface Transaction {
  id: string;
  type: TxType;
  /** Amount in the base currency. All totals and charts use this. */
  amount: number;
  categoryId: string;
  note: string;
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  createdAt: number;
  recurringId?: string;
  /** Account money came from (expense, transfer) or went into (income) */
  accountId?: string;
  /** Destination account for transfers */
  toAccountId?: string;
  /** Set when entered in another currency */
  originalCurrency?: string;
  originalAmount?: number;
  /** Base units per 1 unit of originalCurrency at the time */
  rate?: number;
  /** "sms" when imported from a bank alert */
  source?: "sms";
}

export interface Recurring {
  id: string;
  type: CatType;
  amount: number;
  categoryId: string;
  note: string;
  /** 1–28, the day each month this posts */
  dayOfMonth: number;
  active: boolean;
  /** Last month posted, YYYY-MM */
  lastPosted?: string;
  accountId?: string;
  createdAt: number;
}

export type AccountKind = "cash" | "bank" | "card" | "wallet" | "savings" | "loan";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  color: string;
  openingBalance: number;
  /** Last digits of the account or card number, used to match bank SMS alerts */
  smsDigits?: string;
  archived?: boolean;
  createdAt: number;
}

export interface CustomCategory {
  id: string;
  name: string;
  type: CatType;
  icon: string;
  color: string;
}

export interface Settings {
  displayName?: string;
  monthlyBudget?: number;
  budgets: Record<string, number>;
  /** Base currency, every amount is stored in this */
  currency: string;
  accounts: Account[];
  defaultAccountId?: string;
  customCategories: CustomCategory[];
  hiddenCategories: string[];
  showCents: boolean;
  /** Mask every amount on screen */
  privacy: boolean;
  /** First day of the week for weekday charts: 0 = Sunday, 1 = Monday */
  weekStart: 0 | 1;
  /** What happens to money left at the end of a month */
  leftover: "carry" | "save" | "none";
  /** Your own month dates, keyed by month: { "2026-10": { start: "2026-09-25", end: "2026-10-24" } } */
  periods: Record<string, { start: string; end: string }>;
  /** Categories you picked for places in imported alerts: { "keells super": "groceries" } */
  merchantRules: Record<string, string>;
  /** Currencies offered first in the entry sheet */
  favoriteCurrencies: string[];
  legacyImported?: boolean;
}

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: "cash", name: "Cash", kind: "cash", color: "#2F9E6B", openingBalance: 0, createdAt: 0 },
  { id: "bank", name: "Bank account", kind: "bank", color: "#4C6EDB", openingBalance: 0, createdAt: 1 },
];

export const DEFAULT_SETTINGS: Settings = {
  budgets: {},
  currency: "LKR",
  accounts: DEFAULT_ACCOUNTS,
  defaultAccountId: "cash",
  customCategories: [],
  hiddenCategories: [],
  showCents: false,
  privacy: false,
  weekStart: 1,
  favoriteCurrencies: ["USD", "EUR", "GBP"],
  periods: {},
  leftover: "carry",
  merchantRules: {},
};

export function withDefaults(data: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    budgets: data.budgets ?? {},
    accounts: data.accounts?.length ? data.accounts : DEFAULT_ACCOUNTS,
    customCategories: data.customCategories ?? [],
    hiddenCategories: data.hiddenCategories ?? [],
    periods: data.periods ?? {},
    merchantRules: data.merchantRules ?? {},
    favoriteCurrencies: data.favoriteCurrencies ?? DEFAULT_SETTINGS.favoriteCurrencies,
  };
}
