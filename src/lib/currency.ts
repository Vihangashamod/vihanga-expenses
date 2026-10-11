export interface Currency { code: string; name: string; symbol: string; decimals: number }

/* The currencies people in and around Sri Lanka most often deal with, then major world currencies. */
export const CURRENCIES: Currency[] = [
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", decimals: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimals: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimals: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimals: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", decimals: 2 },
  { code: "QAR", name: "Qatari Riyal", symbol: "QAR", decimals: 2 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD", decimals: 3 },
  { code: "OMR", name: "Omani Rial", symbol: "OMR", decimals: 3 },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BD", decimals: 3 },
  { code: "MVR", name: "Maldivian Rufiyaa", symbol: "Rf", decimals: 2 },
  { code: "PKR", name: "Pakistani Rupee", symbol: "Rs", decimals: 2 },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", decimals: 2 },
  { code: "NPR", name: "Nepalese Rupee", symbol: "Rs", decimals: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0 },
  { code: "CNY", name: "Chinese Yuan", symbol: "CN¥", decimals: 2 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", decimals: 0 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimals: 2 },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimals: 2 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 0 },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", decimals: 2 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", decimals: 0 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimals: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", decimals: 2 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", decimals: 2 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", decimals: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", decimals: 2 },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", decimals: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", decimals: 2 },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));
export const getCurrency = (code: string): Currency => BY_CODE.get(code) ?? { code, name: code, symbol: code, decimals: 2 };

/* ---------- Exchange rates ----------
   Free, key-less source; cached per base currency for 12 hours. Rates are "units of X per 1 base". */
const CACHE_MS = 12 * 3600 * 1000;
type RateTable = { base: string; at: number; rates: Record<string, number> };
const memory = new Map<string, RateTable>();

export async function fetchRates(base: string): Promise<RateTable | null> {
  const cached = memory.get(base) ?? readCache(base);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    if (j.result !== "success" || !j.rates) throw new Error("bad response");
    const table: RateTable = { base, at: Date.now(), rates: j.rates };
    memory.set(base, table);
    try { localStorage.setItem(`ve-rates-${base}`, JSON.stringify(table)); } catch { /* ignore */ }
    return table;
  } catch {
    return cached ?? null; // stale beats nothing
  }
}

function readCache(base: string): RateTable | null {
  try {
    const raw = localStorage.getItem(`ve-rates-${base}`);
    return raw ? (JSON.parse(raw) as RateTable) : null;
  } catch { return null; }
}

/** How many base units one unit of `foreign` is worth, e.g. base LKR, foreign USD → ~300. */
export async function rateToBase(foreign: string, base: string): Promise<number | null> {
  if (foreign === base) return 1;
  const t = await fetchRates(base);
  const r = t?.rates[foreign];
  return r ? 1 / r : null;
}
