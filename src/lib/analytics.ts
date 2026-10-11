import type { Transaction } from "./types";
import { daysInMonth, shiftMonth, thisMonth } from "./format";

export const inMonth = (txs: Transaction[], mk: string) => txs.filter((t) => t.date.startsWith(mk));
export const sum = (txs: Transaction[]) => txs.reduce((s, t) => s + (Number(t.amount) || 0), 0);

export interface MonthSummary {
  mk: string;
  income: number;
  expense: number;
  net: number;
  days: number;
  /** Days elapsed: full month for past, today for current, 0 for future */
  elapsed: number;
  phase: "past" | "current" | "future";
  byCategory: { id: string; total: number; count: number }[];
  count: number;
}

export function summarize(txs: Transaction[], mk: string): MonthSummary {
  const list = inMonth(txs, mk);
  const exp = list.filter((t) => t.type === "expense");
  const inc = list.filter((t) => t.type === "income");
  const cur = thisMonth();
  const days = daysInMonth(mk);
  const phase = mk < cur ? "past" : mk > cur ? "future" : "current";
  const elapsed = phase === "past" ? days : phase === "future" ? 0 : new Date().getDate();
  const map = new Map<string, { total: number; count: number }>();
  exp.forEach((t) => {
    const m = map.get(t.categoryId) ?? { total: 0, count: 0 };
    m.total += Number(t.amount) || 0;
    m.count += 1;
    map.set(t.categoryId, m);
  });
  const byCategory = [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
  const income = sum(inc), expense = sum(exp);
  return { mk, income, expense, net: income - expense, days, elapsed, phase, byCategory, count: list.length };
}

/** Cumulative daily expense for a month: index 0 = start (0), index d = total through day d. */
export function cumulative(txs: Transaction[], mk: string): number[] {
  const days = daysInMonth(mk);
  const per = Array(days + 1).fill(0);
  inMonth(txs, mk).forEach((t) => {
    if (t.type !== "expense") return;
    const d = Number(t.date.slice(8, 10));
    if (d >= 1 && d <= days) per[d] += Number(t.amount) || 0;
  });
  for (let d = 1; d <= days; d++) per[d] += per[d - 1];
  return per;
}

export function lastMonths(mk: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(mk, i - n + 1));
}
