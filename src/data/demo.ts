import { withDefaults, type Recurring, type Settings, type Transaction } from "../lib/types";
import { daysInMonth, shiftMonth, thisMonth } from "../lib/format";

/** Realistic sample data used by demo mode (/?demo). Never written to Firestore. */
export function demoData(): { transactions: Transaction[]; recurring: Recurring[]; settings: Settings } {
  const cur = thisMonth();
  const today = new Date().getDate();
  const tx: Transaction[] = [];
  let n = 0;
  const accountFor = (cat: string, amt: number) =>
    ["housing", "bills", "phone", "insurance", "education", "salary", "freelance", "bonus"].includes(cat) ? "bank"
      : ["shopping", "dining", "subscriptions", "travel", "fuel"].includes(cat) && amt > 1000 ? "card" : "cash";
  const add = (mk: string, day: number, type: Transaction["type"], categoryId: string, amount: number, note: string, extra: Partial<Transaction> = {}) => {
    const d = Math.min(day, daysInMonth(mk));
    tx.push({ id: `demo-${n}`, type, categoryId, amount, note, date: `${mk}-${String(d).padStart(2, "0")}`, createdAt: n++,
      accountId: type === "transfer" ? undefined : accountFor(categoryId, amount), ...extra });
  };
  const rows: [number, string, number, string][] = [
    [1, "housing", 55000, "Rent – Dehiwala flat"], [2, "groceries", 8450, "Keells weekly shop"],
    [3, "transport", 640, "PickMe to office"], [4, "phone", 4990, "SLT Fibre"], [5, "bills", 6230, "CEB electricity"],
    [6, "dining", 450, "Rice & curry lunch"], [7, "subscriptions", 2390, "Netflix + Spotify"],
    [8, "groceries", 5120, "Cargills Food City"], [9, "dining", 1850, "Uber Eats – kottu"], [10, "fuel", 3600, "Petrol – bike"],
    [11, "entertainment", 2400, "Scope Cinemas"], [12, "health", 1280, "Osu Sala pharmacy"], [14, "education", 3990, "Udemy course"],
    [16, "shopping", 7800, "Shirts – Odel"], [17, "bills", 1150, "Water bill"],
    [18, "personal", 1500, "Haircut"], [19, "travel", 1200, "Train to Kandy"], [20, "groceries", 7900, "Keells weekly shop"],
    [22, "dining", 4600, "Dinner with friends"], [24, "transport", 1500, "Bus pass top-up"], [25, "phone", 799, "Dialog reload"],
    [26, "insurance", 4500, "Medical insurance"], [27, "gifts", 5500, "Gift for Amma"], [28, "groceries", 6300, "Arpico"],
    [30, "dining", 1150, "Java Lounge"],
  ];
  for (let back = 5; back >= 0; back--) {
    const mk = shiftMonth(cur, -back);
    const isCur = back === 0;
    add(mk, 1, "income", "salary", 185000, "Monthly salary");
    if (back === 2) add(mk, 18, "income", "bonus", 40000, "Quarterly bonus");
    if (back % 2 === 1 && (!isCur || today >= 21)) add(mk, 21, "income", "freelance", 28000 + back * 3000, "Logo design project");
    if (!isCur || today >= 2) add(mk, 2, "transfer", "transfer", 42000, "ATM withdrawal", { accountId: "bank", toAccountId: "cash" });
    if (!isCur || today >= 15) add(mk, 15, "transfer", "transfer", 20000, "Monthly savings", { accountId: "bank", toAccountId: "savings" });
    if (!isCur || today >= 25) add(mk, 25, "transfer", "transfer", 30000, "Credit card payment", { accountId: "bank", toAccountId: "card" });
    rows.forEach(([day, cat, amt, note], i) => {
      if (cat === "education") {
        if (isCur && day > today) return;
        add(mk, day, "expense", cat, 4196, "Udemy course", { originalCurrency: "USD", originalAmount: 13.99, rate: 299.93, accountId: "card" });
        return;
      }
      if (isCur && day > today) return;
      const wobble = back === 0 ? 1 : 0.82 + (((i * 37 + back * 13) % 35) / 100);
      add(mk, day, "expense", cat, cat === "housing" || cat === "savings" ? amt : Math.round((amt * wobble) / 10) * 10, note);
    });
  }
  const recurring: Recurring[] = [
    { id: "r1", type: "expense", amount: 55000, categoryId: "housing", note: "Rent – Dehiwala flat", dayOfMonth: 1, active: true, lastPosted: cur, createdAt: 1 },
    { id: "r2", type: "expense", amount: 2390, categoryId: "subscriptions", note: "Netflix + Spotify", dayOfMonth: 7, active: true, lastPosted: cur, createdAt: 2 },
    { id: "r3", type: "income", amount: 185000, categoryId: "salary", note: "Monthly salary", dayOfMonth: 1, active: true, lastPosted: cur, createdAt: 3 },
    { id: "r4", type: "expense", amount: 4500, categoryId: "insurance", note: "Medical insurance", dayOfMonth: 26, active: true, lastPosted: shiftMonth(cur, -1), createdAt: 4 },
  ];
  const settings: Settings = withDefaults({
    displayName: "Vihanga",
    currency: "LKR",
    monthlyBudget: 150000,
    budgets: { groceries: 30000, dining: 12000, transport: 6000, shopping: 10000, entertainment: 5000, fuel: 5000, subscriptions: 3000 },
    accounts: [
      { id: "cash", name: "Cash", kind: "cash", color: "#2F9E6B", openingBalance: 8500, createdAt: 0 },
      { id: "bank", name: "Commercial Bank", kind: "bank", color: "#4C6EDB", openingBalance: 240000, createdAt: 1 },
      { id: "card", name: "HNB Visa", kind: "card", color: "#D24C8F", openingBalance: -18000, creditLimit: 150000, dueDay: 15, smsDigits: "4321", createdAt: 2 },
      { id: "savings", name: "Savings (FD)", kind: "savings", color: "#E0A11B", openingBalance: 350000, createdAt: 3 },
    ],
    defaultAccountId: "cash",
    legacyImported: true,
  });
  return { transactions: tx, recurring, settings };
}
