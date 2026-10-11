import type { Account } from "./types";
import { daysBetween } from "./period";
import { todayISO } from "./format";

export interface CardStatus {
  owed: number;
  limit?: number;
  /** 0–1 share of the limit used */
  used?: number;
  available?: number;
  /** Next payment due date, YYYY-MM-DD */
  due?: string;
  daysToDue?: number;
}

/** Next date with the given day of month, today included. */
export function nextDayOfMonth(day: number, from = todayISO()): string {
  const [y, m, d] = from.split("-").map(Number);
  const make = (yy: number, mm: number) => {
    const last = new Date(yy, mm, 0).getDate();
    return `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  };
  return d <= Math.min(day, new Date(y, m, 0).getDate()) ? make(y, m) : m === 12 ? make(y + 1, 1) : make(y, m + 1);
}

export function cardStatus(a: Account, balance: number): CardStatus {
  const owed = Math.max(-balance, 0);
  const out: CardStatus = { owed };
  if (a.creditLimit && a.creditLimit > 0) {
    out.limit = a.creditLimit;
    out.used = Math.min(owed / a.creditLimit, 1);
    out.available = Math.max(a.creditLimit - owed, 0);
  }
  if (a.dueDay) {
    out.due = nextDayOfMonth(a.dueDay);
    out.daysToDue = daysBetween(todayISO(), out.due);
  }
  return out;
}
