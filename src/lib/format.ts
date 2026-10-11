import { getCurrency } from "./currency";

const pad = (n: number) => String(n).padStart(2, "0");

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date) => toISODate(d).slice(0, 7);
export const todayISO = () => toISODate(new Date());
export const thisMonth = () => monthKey(new Date());

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function shiftMonth(mk: string, n: number): string {
  const [y, m] = mk.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

export function daysInMonth(mk: string): number {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthLabel(mk: string, style: "long" | "short" = "long", withYear = true): string {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: style,
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function dayLabel(iso: string): string {
  const today = todayISO();
  const y = toISODate(new Date(Date.now() - 864e5));
  if (iso === today) return "Today";
  if (iso === y) return "Yesterday";
  const d = parseISODate(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/* ---------- Money formatting (configured from settings by the store) ---------- */

const fmt = { currency: "LKR", showCents: false, privacy: false };
export function configureMoney(o: { currency: string; showCents: boolean; privacy: boolean }) { Object.assign(fmt, o); }
export const baseCurrency = () => fmt.currency;
export const isPrivate = () => fmt.privacy;

/** Formats an amount: "Rs 12,500", "$1,250.50". `exact` keeps cents on recorded amounts;
 *  `currency` formats in another currency (for original foreign amounts). */
export function money(n: number, opts: { sign?: boolean; exact?: boolean; currency?: string; reveal?: boolean } = {}): string {
  const cur = getCurrency(opts.currency ?? fmt.currency);
  const sign = n < 0 ? "−" : opts.sign && n > 0 ? "+" : "";
  if (fmt.privacy && !opts.reveal) return `${sign}${cur.symbol} ••••`;
  const wantCents = cur.decimals > 0 && (fmt.showCents || opts.exact);
  const abs = Math.abs(n);
  const hasFraction = Math.round(abs * 10 ** cur.decimals) % 10 ** cur.decimals !== 0;
  const digits = wantCents && (fmt.showCents || hasFraction) ? cur.decimals : 0;
  const body = (digits ? abs : Math.round(abs)).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sep = /^[A-Za-z]/.test(cur.symbol) && cur.symbol.length > 1 ? " " : cur.symbol === "Rs" || cur.symbol === "Rf" || cur.symbol === "kr" ? " " : "";
  return `${sign}${cur.symbol}${sep}${body}`;
}

/** Symbol of the base currency, for input prefixes */
export const currencySymbol = (code?: string) => getCurrency(code ?? fmt.currency).symbol;

/** Compact form for chart axes: 12k, 1.2M */
export function compact(n: number): string {
  if (fmt.privacy) return "•••";
  const a = Math.abs(n);
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(a >= 1e5 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

/** Parses user-typed amounts like "1,250.50" */
export function parseAmount(s: string): number {
  const n = parseFloat(String(s).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
