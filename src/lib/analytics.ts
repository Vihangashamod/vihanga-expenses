import type { Transaction } from "./types";
import { shiftMonth, todayISO } from "./format";
import { currentPeriodKey, dayIndex, inPeriod, periodKeyFor, periodOf, type Period } from "./period";

/** Transactions inside a month's period (calendar month or your own dates). */
export const inMonth = (txs: Transaction[], mk: string) => {
  const p = periodOf(mk);
  return txs.filter((t) => inPeriod(p, t.date));
};
export const sum = (txs: Transaction[]) => txs.reduce((s, t) => s + (Number(t.amount) || 0), 0);

export interface MonthSummary {
  mk: string;
  period: Period;
  income: number;
  expense: number;
  net: number;
  days: number;
  /** Days elapsed: full period for past, today's day number for current, 0 for future */
  elapsed: number;
  phase: "past" | "current" | "future";
  byCategory: { id: string; total: number; count: number }[];
  count: number;
}

export function summarize(txs: Transaction[], mk: string, uptoDay?: number): MonthSummary {
  const period = periodOf(mk);
  let list = inMonth(txs, mk);
  if (uptoDay != null) list = list.filter((t) => dayIndex(period, t.date) <= uptoDay);
  const exp = list.filter((t) => t.type === "expense");
  const inc = list.filter((t) => t.type === "income");
  const cur = currentPeriodKey();
  const phase = mk < cur ? "past" : mk > cur ? "future" : "current";
  const elapsed = phase === "past" ? period.days : phase === "future" ? 0 : Math.min(dayIndex(period, todayISO()), period.days);
  const map = new Map<string, { total: number; count: number }>();
  exp.forEach((t) => {
    const m = map.get(t.categoryId) ?? { total: 0, count: 0 };
    m.total += Number(t.amount) || 0;
    m.count += 1;
    map.set(t.categoryId, m);
  });
  const byCategory = [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
  const income = sum(inc), expense = sum(exp);
  return { mk, period, income, expense, net: income - expense, days: period.days, elapsed, phase, byCategory, count: list.length };
}

/** Cumulative expense through a period: index 0 = start (0), index d = total through day d. */
export function cumulative(txs: Transaction[], mk: string): number[] {
  const p = periodOf(mk);
  const per = Array(p.days + 1).fill(0);
  txs.forEach((t) => {
    if (t.type !== "expense" || !inPeriod(p, t.date)) return;
    per[dayIndex(p, t.date)] += Number(t.amount) || 0;
  });
  for (let d = 1; d <= p.days; d++) per[d] += per[d - 1];
  return per;
}

/** Current balance of each account. Entries without an account belong to the default account. */
export function balances(accounts: { id: string; openingBalance: number }[], txs: Transaction[], defaultId?: string): Map<string, number> {
  const fallback = defaultId && accounts.some((a) => a.id === defaultId) ? defaultId : accounts[0]?.id;
  const out = new Map(accounts.map((a) => [a.id, Number(a.openingBalance) || 0]));
  const add = (id: string | undefined, v: number) => {
    const key = id && out.has(id) ? id : fallback;
    if (key) out.set(key, (out.get(key) ?? 0) + v);
  };
  txs.forEach((t) => {
    const v = Number(t.amount) || 0;
    if (t.type === "income") add(t.accountId, v);
    else if (t.type === "expense") add(t.accountId, -v);
    else { add(t.accountId, -v); add(t.toAccountId, v); }
  });
  return out;
}

/** The account an entry counts against, resolving missing ids to the default. */
export function accountOf(t: Transaction, accountIds: string[], defaultId?: string): string | undefined {
  if (t.accountId && accountIds.includes(t.accountId)) return t.accountId;
  return defaultId && accountIds.includes(defaultId) ? defaultId : accountIds[0];
}

export function lastMonths(mk: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(mk, i - n + 1));
}

/* ---------- Leftover money ---------- */
export interface LeftoverRow { mk: string; base: number; carriedIn: number; spent: number; left: number }
export interface Leftover {
  /** Money brought into `mk` from earlier months (carry mode); can be negative after an overspend */
  carriedIn: number;
  /** Positive leftovers from closed months (save mode) */
  saved: number;
  /** Closed months, oldest first */
  rows: LeftoverRow[];
}

/** Base amount a month is measured against: the monthly budget, or that month's income. */
export const baseFor = (txs: Transaction[], mk: string, budget?: number) =>
  budget && budget > 0 ? budget : sum(inMonth(txs, mk).filter((t) => t.type === "income"));

/** Walks closed months before `mk` (from your first entry, at most 36 months) and works out what was left. */
export function leftover(txs: Transaction[], mk: string, budget: number | undefined, mode: "carry" | "save" | "none"): Leftover {
  const out: Leftover = { carriedIn: 0, saved: 0, rows: [] };
  if (!txs.length) return out;
  const firstDate = txs.reduce((m, t) => (t.date < m ? t.date : m), txs[0].date);
  let k = periodKeyFor(firstDate);
  const earliest = shiftMonth(mk, -36);
  if (k < earliest) k = earliest;
  let carry = 0;
  for (; k < mk; k = shiftMonth(k, 1)) {
    const base = baseFor(txs, k, budget);
    const spent = sum(inMonth(txs, k).filter((t) => t.type === "expense"));
    const carriedIn = mode === "carry" ? carry : 0;
    const left = base + carriedIn - spent;
    out.rows.push({ mk: k, base, carriedIn, spent, left });
    if (mode === "carry") carry = left;
    if (mode === "save") out.saved += Math.max(base - spent, 0);
  }
  out.carriedIn = mode === "carry" ? carry : 0;
  return out;
}
