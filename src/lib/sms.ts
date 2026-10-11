/* Reads bank SMS alerts (HNB formats first, with a generic fallback) into transactions you can review.
   Only the amount, date, place and account digits are kept: never the full message. */

export interface ParsedAlert {
  /** Stable id from date, time, amount and account, so the same alert is never added twice */
  key: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  amount: number;
  currency: string;
  direction: "debit" | "credit";
  kind: "purchase" | "charge" | "withdrawal" | "transfer" | "deposit" | "other";
  /** Shop or remark, cleaned up */
  merchant: string;
  /** Visible trailing account/card digits, e.g. "6576" */
  digits?: string;
  balance?: number;
  bank?: string;
  categoryId: string;
  accountId?: string;
}

export interface ParseResult { alerts: ParsedAlert[]; skipped: string[] }

const num = (s: string) => parseFloat(s.replace(/,/g, ""));

function isoFrom(d: string, m: string, y: string): string | null {
  const day = +d, mon = +m;
  let yr = +y;
  if (yr < 100) yr += 2000;
  if (!(day >= 1 && day <= 31 && mon >= 1 && mon <= 12 && yr > 2000)) return null;
  return `${yr}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function trailingDigits(acct: string): string | undefined {
  const m = acct.match(/(\d+)\s*$/);
  return m ? m[1] : undefined;
}

/** Splits pasted text into separate alerts. Each line starts a new alert unless it clearly
 *  continues the previous one (e.g. "Remarks :…", "Bal: …"), or it's a blank-line-separated block. */
const CONTINUES = (l: string) =>
  /^(remarks|bal\b|balance|av\.?\s*bal|avl|hot ?line|location|amount|date|time|ref|txn)/i.test(l) || /^[a-z,.;:)(-]/.test(l);
const STARTS = /^(HNB SMS ALERT|A Transaction for|Dear (Customer|Cardholder))/i;

export function splitAlerts(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { out.push(""); continue; }
    const last = out.length ? out[out.length - 1] : "";
    if (last && !STARTS.test(line) && CONTINUES(line)) out[out.length - 1] = `${last} ${line}`;
    else out.push(line);
  }
  return out.map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 10);
}

/* ---------- Category guesses from the place name ---------- */
const RULES: [RegExp, string][] = [
  [/alert charge|sms charge|service charge|annual fee|\bfee\b|commission|late payment|interest|stamp duty/i, "loans"],
  [/keells|cargills|food ?city|arpico|glomark|laugfs super|spar|super ?market|grocer|sathosa|lanka sathosa|marketing/i, "groceries"],
  [/ceypetco|lanka ioc|\bioc\b|filling station|fuel|petrol|sinopec|shed\b|lanka filling/i, "fuel"],
  [/pickme|uber(?! ?eats)|kangaroo|taxi|cab\b|sltb|railway|bus\b|expressway|highway|parking/i, "transport"],
  [/uber ?eats|pickme food|kfc|pizza|mcdonald|burger|java|barista|cafe|coffee|restaurant|hotel|bakery|kottu|dine|eats/i, "dining"],
  [/dialog|mobitel|slt|hutch|airtel|telecom|broadband|reload/i, "phone"],
  [/\bceb\b|leco|water board|nwsdb|electric|gas\b|litro/i, "bills"],
  [/netflix|spotify|youtube|google|apple\.com|icloud|microsoft|adobe|chatgpt|openai|anthropic|claude/i, "subscriptions"],
  [/pharma|osu ?sala|hospital|medical|clinic|channel|asiri|nawaloka|durdans|hemas|lanka hospitals|suwa ?sevana|healthguard|dental|lab\b/i, "health"],
  [/odel|cool planet|fashion bug|nolimit|kandy ?ide|daraz|amazon|aliexpress|temu|singer|abans|softlogic|damro|store|mart\b/i, "shopping"],
  [/scope|cinema|pvr|movie|savoy|liberty|ticket|event/i, "entertainment"],
  [/school|university|institute|campus|udemy|coursera|tuition|academy/i, "education"],
  [/insurance|ceylinco|aia|allianz|softlogic life|janashakthi|union assurance/i, "insurance"],
  [/salon|spa\b|barber|beauty/i, "personal"],
  [/airline|airways|booking\.com|agoda|airbnb|resort|travel/i, "travel"],
];

export function guessCategory(merchant: string, kind: ParsedAlert["kind"], direction: ParsedAlert["direction"], learned: Record<string, string> = {}): string {
  const key = merchantKey(merchant);
  if (key && learned[key]) return learned[key];
  if (direction === "credit") return /salary|payroll/i.test(merchant) ? "salary" : /refund|reversal/i.test(merchant) ? "refund" : "other-in";
  if (kind === "charge") return "loans";
  for (const [re, cat] of RULES) if (re.test(merchant)) return cat;
  return "other";
}

/** Normalised merchant name used to remember your category choices. */
export const merchantKey = (m: string) => m.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 40);

function cleanMerchant(s: string): string {
  if (/finacle alert charge/i.test(s)) return "SMS alert charge";
  return s
    .replace(/,\s*[A-Z]{2}\s*$/, "") // ", LK"
    .replace(/\s{2,}/g, " ")
    .replace(/\.$/, "")
    .trim();
}

function hashKey(parts: (string | number | undefined)[]): string {
  const s = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "sms_" + (h >>> 0).toString(36);
}

/* ---------- Format readers ---------- */
type Reader = (msg: string) => Omit<ParsedAlert, "key" | "categoryId" | "accountId"> | null;

// HNB SMS ALERT: PURCHASE, Debit account:2010***6576,Location:Suwa Sevana - Bandaragama, LK,Amount(Approx.):3900.00 LKR,Av.Bal:18650.43 LKR,Date:10.10.26,Time:08:06, Hot Line:...
const hnbAlert: Reader = (msg) => {
  if (!/HNB SMS ALERT/i.test(msg)) return null;
  const type = (msg.match(/HNB SMS ALERT:\s*([A-Z /-]+?)\s*,/i)?.[1] ?? "").toUpperCase();
  const acct = msg.match(/(Debit|Credit) (?:account|card)\s*:\s*([\dX*]+)/i);
  const amt = msg.match(/Amount(?:\s*\(Approx\.?\))?\s*:\s*([\d,]+(?:\.\d+)?)\s*([A-Z]{3})?/i);
  const date = msg.match(/Date\s*:\s*(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/i);
  const time = msg.match(/Time\s*:\s*(\d{1,2}:\d{2})/i);
  const loc = msg.match(/Location\s*:\s*(.+?)\s*,\s*Amount/i);
  const bal = msg.match(/(?:Av\.?\s*Bal|Bal(?:ance)?)\s*:\s*([\d,]+(?:\.\d+)?)/i);
  if (!amt || !date) return null;
  const iso = isoFrom(date[1], date[2], date[3]);
  if (!iso) return null;
  const isCredit = /REFUND|REVERSAL|CREDIT|DEPOSIT/.test(type) || (acct?.[1] ?? "").toLowerCase() === "credit" && !/PURCHASE|WITHDRAW/.test(type);
  const kind: ParsedAlert["kind"] = /WITHDRAW|ATM|CASH/.test(type) ? "withdrawal" : /PURCHASE|POS|ECOM|ONLINE|PAY|BILL|DEBIT/.test(type) ? "purchase"
    : /TRANSFER|CEFT|SLIPS/.test(type) ? "transfer" : isCredit ? "deposit" : "other";
  const merchant = cleanMerchant(loc?.[1] ?? (type ? type.charAt(0) + type.slice(1).toLowerCase() : "HNB transaction"));
  return {
    date: iso, time: time?.[1], amount: num(amt[1]), currency: (amt[2] ?? "LKR").toUpperCase(),
    direction: isCredit ? "credit" : "debit", kind, merchant, digits: trailingDigits(acct?.[2] ?? ""),
    balance: bal ? num(bal[1]) : undefined, bank: "HNB",
  };
};

// A Transaction for LKR 25.00 has been debit ed to Ac No:20102XXXXX76 on 10/10/26 07:47:24 . Remarks :Finacle Alert Charges.Bal: LKR 22,550.43
const finacle: Reader = (msg) => {
  const m = msg.match(/Transaction for\s*([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s*has been\s*(debit|credit|paid|charg|withdraw)\s*(?:ed|n)?\s*(?:to|from|by|on)\s*Ac(?:count)?\s*No\s*:?\s*([\dX*]+)\s*on\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\s*(\d{1,2}:\d{2})?/i);
  if (!m) return null;
  const iso = isoFrom(m[5], m[6], m[7]);
  if (!iso) return null;
  const remarks = msg.match(/Remarks\s*:\s*(.+?)(?:\.\s*Bal|\s+Bal\s*:|$)/i)?.[1] ?? "";
  const bal = msg.match(/Bal(?:ance)?\s*:\s*[A-Z]{3}\s*([\d,]+(?:\.\d+)?)/i);
  const credit = /^credit/i.test(m[3]);
  const kind: ParsedAlert["kind"] = /charge|fee|commission/i.test(remarks) ? "charge" : /atm|cash/i.test(remarks) ? "withdrawal"
    : /transfer|ceft|slips|fund/i.test(remarks) ? "transfer" : credit ? "deposit" : "other";
  return {
    date: iso, time: m[8], amount: num(m[2]), currency: m[1].toUpperCase(), direction: credit ? "credit" : "debit", kind,
    merchant: cleanMerchant(remarks || (credit ? "Deposit" : "Account debit")), digits: trailingDigits(m[4]),
    balance: bal ? num(bal[1]) : undefined, bank: "HNB",
  };
};

/* Currency codes and symbols seen in alerts. Code before or after the number: "USD 13.99", "13.99 USD", "$13.99". */
const SYMBOLS: Record<string, string> = { "US$": "USD", "$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "RS": "LKR", "RS.": "LKR", "SLR": "LKR" };
const CODES = "LKR|USD|EUR|GBP|AUD|CAD|SGD|AED|SAR|QAR|KWD|OMR|BHD|INR|MVR|JPY|CNY|MYR|THB|HKD|CHF|NZD";
function findAmount(msg: string): { raw: string; value: string; currency: string } | null {
  const before = msg.match(new RegExp(`(${CODES}|US\\$|Rs\\.?|SLR|[$€£₹])\\s*:?\\s*([\\d,]+(?:\\.\\d{1,3})?)`, "i"));
  const after = msg.match(new RegExp(`([\\d,]+(?:\\.\\d{1,3})?)\\s*(${CODES}|Rs\\b)`, "i"));
  const pick = before && (!after || (before.index ?? 0) <= (after.index ?? 0))
    ? { raw: before[0], value: before[2], cur: before[1] }
    : after ? { raw: after[0], value: after[1], cur: after[2] } : null;
  if (!pick || !/\d/.test(pick.value)) return null;
  const c = pick.cur.toUpperCase();
  return { raw: pick.raw, value: pick.value, currency: SYMBOLS[c] ?? c };
}

// Fallback for other banks and wordings: an amount with LKR/Rs and a date somewhere in the message.
const OUT = /\b(debit(?:ed)?|debit ed|purchase[sd]?|paid|payment|spent|charged|withdrawn|withdrawal|deducted|transferred to|sent to)\b/i;
const IN = /\b(credit(?:ed)?|credit ed|received|deposit(?:ed)?|refund(?:ed)?|reversal|reversed|salary)\b/i;

const generic: Reader = (msg) => {
  const found = findAmount(msg);
  const amt = found ? [found.raw, found.value] as const : null;
  const date = msg.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!amt || !date) return null;
  const iso = isoFrom(date[1], date[2], date[3]);
  if (!iso) return null;
  const out = OUT.test(msg), inn = IN.test(msg);
  const credit = inn && !out;
  const at = msg.match(/(?:\bat\b|@|\bto\b|Merchant\s*:|Location\s*:|Payee\s*:)\s*([A-Za-z][A-Za-z0-9 &'.-]{2,40}?)(?=\s*(?:,|\.\s|\bon\b|\bfor\b|\bLKR\b|\bRs\b|$))/i)?.[1];
  const kind: ParsedAlert["kind"] = /atm|withdraw|cash/i.test(msg) ? "withdrawal" : /\b(fees?|commission|charges)\b|alert charge|service charge/i.test(msg) && !/purchase|paid at|charged .{0,30}\bat\b/i.test(msg) ? "charge"
    : /purchase|pos|paid|payment|spent|charged/i.test(msg) ? "purchase" : /transfer|ceft|slips/i.test(msg) ? "transfer" : credit ? "deposit" : "other";
  return {
    date: iso, time: msg.match(/(\d{1,2}:\d{2})/)?.[1], amount: num(amt[1]), currency: found!.currency,
    direction: credit ? "credit" : "debit", kind,
    merchant: cleanMerchant(at && kind !== "withdrawal" ? at : kind === "withdrawal" ? "ATM withdrawal" : credit ? "Bank credit" : kind === "charge" ? "Bank charge" : "Bank debit"),
    digits: trailingDigits(msg.match(/(?:A\/?C|Ac No|account|card)[^\d]{0,12}([\dX*]{4,})/i)?.[1] ?? ""),
  };
};

const looksLikeOtp = (s: string) => /\b(OTP|one[- ]time|verification code|passcode|PIN)\b/i.test(s);

/** Parses pasted alerts. `accounts` maps visible account digits to your accounts. */
export function parseAlerts(
  text: string,
  accounts: { id: string; smsDigits?: string }[] = [],
  learned: Record<string, string> = {},
): ParseResult {
  const alerts: ParsedAlert[] = [];
  const skipped: string[] = [];
  for (const msg of splitAlerts(text)) {
    if (looksLikeOtp(msg)) { skipped.push("A one-time code message (ignored)"); continue; }
    const r = hnbAlert(msg) ?? finacle(msg) ?? generic(msg);
    if (!r || !(r.amount > 0)) { skipped.push(msg.slice(0, 60) + (msg.length > 60 ? "…" : "")); continue; }
    const acc = r.digits ? accounts.find((a) => a.smsDigits && (a.smsDigits.endsWith(r.digits!) || r.digits!.endsWith(a.smsDigits))) : undefined;
    alerts.push({
      ...r,
      key: hashKey([r.date, r.time, r.amount.toFixed(2), r.digits, r.direction]),
      categoryId: guessCategory(r.merchant, r.kind, r.direction, learned),
      accountId: acc?.id,
    });
  }
  return { alerts, skipped };
}
