import { monthKey, parseISODate, shiftMonth, shortDate, toISODate, todayISO } from "./format";

/* A "month" in the app is a period you can define yourself, e.g. October = 25 Sep → 24 Oct.
   Months without their own dates continue from the previous custom month (start = previous end + 1,
   running one month); with nothing set they fall back to the calendar month. */

export interface Period {
  /** Month key the period is named after, YYYY-MM */
  mk: string;
  /** Inclusive dates, YYYY-MM-DD */
  start: string;
  end: string;
  days: number;
  /** Dates were set (or continued from dates set) by you */
  custom: boolean;
}

export type PeriodMap = Record<string, { start: string; end: string }>;

let custom: PeriodMap = {};
const cache = new Map<string, Period>();

export function configurePeriods(map: PeriodMap | undefined) {
  const next = map ?? {};
  if (JSON.stringify(next) === JSON.stringify(custom)) return;
  custom = next;
  cache.clear();
}

const addDays = (iso: string, n: number) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};
export const daysBetween = (a: string, b: string) => Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 864e5);

function calendar(mk: string): Period {
  const [y, m] = mk.split("-").map(Number);
  const start = `${mk}-01`;
  const end = toISODate(new Date(y, m, 0));
  return { mk, start, end, days: daysBetween(start, end) + 1, custom: false };
}

/** One month after `start`, minus a day: 25 Sep → 24 Oct */
function monthFrom(start: string): string {
  const d = parseISODate(start);
  const day = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return addDays(toISODate(next), -1);
}

export function periodOf(mk: string, depth = 0): Period {
  const hit = cache.get(mk);
  if (hit) return hit;
  let p: Period;
  const own = custom[mk];
  if (own && own.start <= own.end) {
    p = { mk, start: own.start, end: own.end, days: daysBetween(own.start, own.end) + 1, custom: true };
  } else if (depth < 36 && Object.keys(custom).some((k) => k < mk)) {
    const prev = periodOf(shiftMonth(mk, -1), depth + 1);
    if (prev.custom) {
      const start = addDays(prev.end, 1);
      const end = monthFrom(start);
      p = { mk, start, end, days: daysBetween(start, end) + 1, custom: true };
    } else p = calendar(mk);
  } else p = calendar(mk);
  // Don't overlap a following month that has its own dates: end the day before it starts.
  const next = custom[shiftMonth(mk, 1)];
  if (!own && next && next.start <= p.end && next.start > p.start) {
    p = { ...p, end: addDays(next.start, -1), days: daysBetween(p.start, addDays(next.start, -1)) + 1 };
  }
  cache.set(mk, p);
  return p;
}

/** The month whose period contains a date (checks the neighbouring months too). */
export function periodKeyFor(iso: string): string {
  const mk = monthKey(parseISODate(iso));
  for (const k of [mk, shiftMonth(mk, 1), shiftMonth(mk, -1), shiftMonth(mk, 2), shiftMonth(mk, -2)]) {
    const p = periodOf(k);
    if (iso >= p.start && iso <= p.end) return k;
  }
  return mk;
}

export const ownPeriod = (mk: string) => custom[mk];

export const currentPeriodKey = () => periodKeyFor(todayISO());

/** 1-based day of the period a date falls on */
export const dayIndex = (p: Period, iso: string) => daysBetween(p.start, iso) + 1;

/** ISO date of the n-th day of a period (1-based) */
export const dateAt = (p: Period, n: number) => addDays(p.start, n - 1);

export const inPeriod = (p: Period, iso: string) => iso >= p.start && iso <= p.end;

/** "25 Sep – 24 Oct", or "" for a plain calendar month */
export function rangeLabel(p: Period, always = false): string {
  if (!p.custom && !always) return "";
  const sameYear = p.start.slice(0, 4) === p.end.slice(0, 4);
  return `${shortDate(p.start, !sameYear)} – ${shortDate(p.end, !sameYear)}`;
}

/** Short label for a chart tick on day n of a period: "25 Sep" */
export const tickLabel = (p: Period, n: number) => shortDate(dateAt(p, n), false, p.custom);
