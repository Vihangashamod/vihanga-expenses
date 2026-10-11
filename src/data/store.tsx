import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type User } from "firebase/auth";
import {
  collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, writeBatch,
} from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { DEFAULT_SETTINGS, withDefaults, type Recurring, type Settings, type Transaction } from "../lib/types";
import { configureMoney, daysInMonth, thisMonth, uid } from "../lib/format";
import { configurePeriods } from "../lib/period";
import { LEGACY_CATEGORY_MAP, setCategoryRegistry } from "../lib/categories";
import { demoData } from "./demo";

export type Status = "loading" | "signed-out" | "ready";
export type Sync = "synced" | "saving" | "offline" | "error";

export interface Backup { app: "vihanga-expenses"; version: 2; exportedAt: string; transactions: Transaction[]; recurring: Recurring[]; settings: Settings }
export interface LegacyBundle { transactions: Transaction[]; source: string }

interface Store {
  status: Status;
  demo: boolean;
  user: { name: string; email: string; photo?: string } | null;
  sync: Sync;
  error: string | null;
  transactions: Transaction[];
  recurring: Recurring[];
  settings: Settings;
  legacy: LegacyBundle | null;
  saveTransaction: (t: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  saveRecurring: (r: Recurring) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  importLegacy: () => Promise<number>;
  saveMany: (txs: Transaction[]) => Promise<void>;
  restoreBackup: (b: Backup) => Promise<number>;
  deleteAllData: () => Promise<void>;
  changeBaseCurrency: (code: string, factor: number | null) => Promise<void>;
  dismissLegacy: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
};

const isDemo = () => new URLSearchParams(location.search).has("demo") || sessionStorage.getItem("ve-demo") === "1";

function authMessage(code: string, fallback: string) {
  const map: Record<string, string> = {
    "auth/operation-not-allowed": "Google sign-in is turned off for this project. Turn it on in Firebase Console → Authentication → Sign-in method.",
    "auth/configuration-not-found": "Sign-in isn't set up for this app yet. In Firebase Console, open Authentication, click Get started, and enable Google under Sign-in method.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
    "auth/unauthorized-domain": "This web address isn't allowed to sign in. Add it in Firebase Console → Authentication → Settings → Authorized domains.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/network-request-failed": "No connection. Check your internet and try again.",
  };
  return map[code] ?? fallback;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const demo = useMemo(isDemo, []);
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [sync, setSync] = useState<Sync>("synced");
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [legacy, setLegacy] = useState<LegacyBundle | null>(null);
  const loaded = useRef({ tx: false, rec: false, set: false });
  const [loadTick, setLoadTick] = useState(0);

  /* ---------- Demo mode: everything in memory ---------- */
  useEffect(() => {
    if (!demo) return;
    sessionStorage.setItem("ve-demo", "1");
    const d = demoData();
    setTransactions(d.transactions);
    setRecurring(d.recurring);
    setSettings(d.settings);
    setStatus("ready");
  }, [demo]);

  /* ---------- Cloud mode ---------- */
  useEffect(() => {
    if (demo) return;
    let unsubs: (() => void)[] = [];
    const stop = onAuthStateChanged(auth, (u) => {
      unsubs.forEach((f) => f());
      unsubs = [];
      setUser(u);
      loaded.current = { tx: false, rec: false, set: false };
      if (!u) {
        setTransactions([]); setRecurring([]); setSettings(DEFAULT_SETTINGS); setLegacy(null);
        setStatus("signed-out");
        return;
      }
      setStatus("loading");
      const base = ["users", u.uid] as const;
      const markLoaded = (k: keyof typeof loaded.current) => {
        if (!loaded.current[k]) { loaded.current[k] = true; setLoadTick((t) => t + 1); }
        if (loaded.current.tx && loaded.current.rec && loaded.current.set) setStatus("ready");
      };
      const onErr = (e: { code?: string; message: string }) => {
        setSync("error");
        setError(e.code === "permission-denied"
          ? "Firestore refused access. Deploy the security rules in firestore.rules so you can read your own data."
          : `Couldn't reach your data: ${e.message}`);
        setStatus("ready");
      };
      unsubs.push(onSnapshot(collection(db, ...base, "transactions"), { includeMetadataChanges: true }, (snap) => {
        setTransactions(snap.docs.map((d) => ({ ...(d.data() as Transaction), id: d.id })));
        setSync(snap.metadata.hasPendingWrites ? "saving" : snap.metadata.fromCache && !navigator.onLine ? "offline" : "synced");
        markLoaded("tx");
      }, onErr));
      unsubs.push(onSnapshot(collection(db, ...base, "recurring"), (snap) => {
        setRecurring(snap.docs.map((d) => ({ ...(d.data() as Recurring), id: d.id })));
        markLoaded("rec");
      }, onErr));
      unsubs.push(onSnapshot(doc(db, ...base, "meta", "settings"), (snap) => {
        setSettings(withDefaults(snap.exists() ? (snap.data() as Partial<Settings>) : {}));
        markLoaded("set");
      }, onErr));
    });
    const online = () => setSync((s) => (s === "offline" ? "synced" : s));
    const offline = () => setSync("offline");
    addEventListener("online", online);
    addEventListener("offline", offline);
    return () => { stop(); unsubs.forEach((f) => f()); removeEventListener("online", online); removeEventListener("offline", offline); };
  }, [demo]);

  const userPath = useCallback((...p: string[]) => {
    if (!auth.currentUser) throw new Error("Not signed in");
    return ["users", auth.currentUser.uid, ...p] as [string, ...string[]];
  }, []);

  const guard = useCallback(async (fn: () => Promise<unknown>) => {
    try { setSync("saving"); await fn(); setError(null); setSync(navigator.onLine ? "synced" : "offline"); }
    catch (e) { setSync("error"); setError((e as Error).message); throw e; }
  }, []);

  /* ---------- Post due recurring items for this month (idempotent ids) ---------- */
  useEffect(() => {
    if (demo || status !== "ready" || !auth.currentUser) return;
    const mk = thisMonth();
    const today = new Date().getDate();
    const due = recurring.filter((r) => r.active && (r.lastPosted ?? "") < mk && today >= Math.min(r.dayOfMonth, daysInMonth(mk)));
    if (!due.length) return;
    const batch = writeBatch(db);
    due.forEach((r) => {
      const id = `rec_${r.id}_${mk}`;
      const day = String(Math.min(r.dayOfMonth, daysInMonth(mk))).padStart(2, "0");
      const t: Transaction = { id, type: r.type, amount: r.amount, categoryId: r.categoryId, note: r.note, date: `${mk}-${day}`, createdAt: Date.now(), recurringId: r.id, ...(r.accountId ? { accountId: r.accountId } : {}) };
      batch.set(doc(db, ...userPath("transactions", id)), t);
      batch.set(doc(db, ...userPath("recurring", r.id)), { lastPosted: mk }, { merge: true });
    });
    batch.commit().catch((e) => setError(`Couldn't add recurring items: ${e.message}`));
  }, [demo, status, recurring, userPath]);

  /* ---------- Find data from the earlier versions of the app ---------- */
  useEffect(() => {
    if (demo || status !== "ready" || !auth.currentUser || settings.legacyImported || legacy) return;
    let cancelled = false;
    (async () => {
      const found: Transaction[] = [];
      let source = "";
      const mapCat = (c: unknown) => LEGACY_CATEGORY_MAP[String(c ?? "")] ?? "other";
      const fromOld = (e: Record<string, unknown>, i: number): Transaction | null => {
        const amount = Number(e.amount);
        const date = typeof e.date === "string" ? e.date.slice(0, 10) : "";
        if (!(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        return { id: `legacy_${String(e.id ?? i)}`, type: "expense", amount, categoryId: mapCat(e.cat ?? e.category),
          note: String(e.desc ?? e.description ?? e.name ?? "Expense"), date, createdAt: Number(e.createdAt) || i };
      };
      const salariesToIncome = (s: Record<string, number>) =>
        Object.entries(s).filter(([k, v]) => /^\d{4}-\d{2}$/.test(k) && Number(v) > 0).map(([k, v]) => ({
          id: `legacy_salary_${k}`, type: "income" as const, amount: Number(v), categoryId: "salary", note: "Monthly salary", date: `${k}-01`, createdAt: 0,
        }));
      try {
        const snap = await getDocs(collection(db, ...userPath("expenses")));
        snap.docs.forEach((d, i) => { const t = fromOld({ id: d.id, ...d.data() }, i); if (t) found.push(t); });
        if (found.length) source = "your previous cloud data";
      } catch { /* collection unreadable or absent */ }
      try {
        const raw = localStorage.getItem("vihanga-expenses-v2");
        if (raw) {
          const d = JSON.parse(raw);
          if (!d.sample && Array.isArray(d.expenses) && d.expenses.length) {
            d.expenses.forEach((e: Record<string, unknown>, i: number) => { const t = fromOld(e, i); if (t && !found.some((f) => f.id === t.id)) found.push(t); });
            found.push(...salariesToIncome(d.salaries ?? {}));
            source = source ? "your previous cloud and device data" : "this device";
          }
        }
      } catch { /* storage unavailable */ }
      if (!cancelled && found.length) setLegacy({ transactions: found, source });
    })();
    return () => { cancelled = true; };
  }, [demo, status, settings.legacyImported, legacy, userPath]);

  /* ---------- Actions ---------- */
  const saveTransaction = useCallback(async (t: Transaction) => {
    if (demo) { setTransactions((xs) => [...xs.filter((x) => x.id !== t.id), t]); return; }
    await guard(() => setDoc(doc(db, ...userPath("transactions", t.id)), t));
  }, [demo, guard, userPath]);

  const deleteTransaction = useCallback(async (id: string) => {
    if (demo) { setTransactions((xs) => xs.filter((x) => x.id !== id)); return; }
    await guard(() => deleteDoc(doc(db, ...userPath("transactions", id))));
  }, [demo, guard, userPath]);

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    if (demo) { setSettings((s) => ({ ...s, ...patch })); return; }
    // Budgets are replaced as a whole so removed limits disappear.
    setSettings((s) => ({ ...s, ...patch }));
    await guard(async () => {
      const ref = doc(db, ...userPath("meta", "settings"));
      // Maps are replaced as a whole so removed keys (a budget, a month's dates) really disappear.
      const mapKeys = (["budgets", "periods", "merchantRules"] as const).filter((k) => patch[k] !== undefined);
      if (mapKeys.length) {
        const rest: Partial<Settings> = { ...patch };
        mapKeys.forEach((k) => delete rest[k]);
        if (Object.keys(rest).length) await setDoc(ref, rest, { merge: true });
        await setDoc(ref, Object.fromEntries(mapKeys.map((k) => [k, patch[k]])), { mergeFields: [...mapKeys] });
      } else {
        await setDoc(ref, patch, { merge: true });
      }
    });
  }, [demo, guard, userPath]);

  const saveRecurring = useCallback(async (r: Recurring) => {
    if (demo) { setRecurring((xs) => [...xs.filter((x) => x.id !== r.id), r]); return; }
    await guard(() => setDoc(doc(db, ...userPath("recurring", r.id)), r));
  }, [demo, guard, userPath]);

  const deleteRecurring = useCallback(async (id: string) => {
    if (demo) { setRecurring((xs) => xs.filter((x) => x.id !== id)); return; }
    await guard(() => deleteDoc(doc(db, ...userPath("recurring", id))));
  }, [demo, guard, userPath]);

  const importLegacy = useCallback(async () => {
    if (!legacy) return 0;
    const list = legacy.transactions;
    await guard(async () => {
      for (let i = 0; i < list.length; i += 400) {
        const batch = writeBatch(db);
        list.slice(i, i + 400).forEach((t) => batch.set(doc(db, ...userPath("transactions", t.id)), t));
        await batch.commit();
      }
      await setDoc(doc(db, ...userPath("meta", "settings")), { legacyImported: true }, { merge: true });
    });
    setLegacy(null);
    return list.length;
  }, [legacy, guard, userPath]);

  const dismissLegacy = useCallback(async () => {
    setLegacy(null);
    if (!demo) await setDoc(doc(db, ...userPath("meta", "settings")), { legacyImported: true }, { merge: true });
  }, [demo, userPath]);

  /** Writes many documents in batches of 400 (Firestore allows 500 per batch). */
  const commitInBatches = useCallback(async (ops: ((b: ReturnType<typeof writeBatch>) => void)[]) => {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      ops.slice(i, i + 400).forEach((op) => op(batch));
      await batch.commit();
    }
  }, []);

  const saveMany = useCallback(async (txs: Transaction[]) => {
    if (demo) { setTransactions((xs) => { const ids = new Set(txs.map((t) => t.id)); return [...xs.filter((x) => !ids.has(x.id)), ...txs]; }); return; }
    await guard(() => commitInBatches(txs.map((t) => (b) => b.set(doc(db, ...userPath("transactions", t.id)), t))));
  }, [demo, guard, commitInBatches, userPath]);

  const restoreBackup = useCallback(async (bk: Backup) => {
    const txs = (bk.transactions ?? []).filter((t) => t && t.id && t.date && Number(t.amount) > 0);
    const rec = (bk.recurring ?? []).filter((r) => r && r.id);
    const st = withDefaults(bk.settings ?? {});
    if (demo) { setTransactions(txs); setRecurring(rec); setSettings(st); return txs.length; }
    await guard(async () => {
      await commitInBatches([
        ...txs.map((t) => (b: ReturnType<typeof writeBatch>) => b.set(doc(db, ...userPath("transactions", t.id)), t)),
        ...rec.map((r) => (b: ReturnType<typeof writeBatch>) => b.set(doc(db, ...userPath("recurring", r.id)), r)),
      ]);
      await setDoc(doc(db, ...userPath("meta", "settings")), { ...st, legacyImported: true });
    });
    return txs.length;
  }, [demo, guard, commitInBatches, userPath]);

  const deleteAllData = useCallback(async () => {
    if (demo) { setTransactions([]); setRecurring([]); setSettings({ ...DEFAULT_SETTINGS, legacyImported: true }); return; }
    await guard(async () => {
      await commitInBatches([
        ...transactions.map((t) => (b: ReturnType<typeof writeBatch>) => b.delete(doc(db, ...userPath("transactions", t.id)))),
        ...recurring.map((r) => (b: ReturnType<typeof writeBatch>) => b.delete(doc(db, ...userPath("recurring", r.id)))),
      ]);
      await setDoc(doc(db, ...userPath("meta", "settings")), { ...DEFAULT_SETTINGS, legacyImported: true });
    });
  }, [demo, guard, commitInBatches, userPath, transactions, recurring]);

  /** Switches the base currency. With a factor, every stored amount is converted (new = old × factor). */
  const changeBaseCurrency = useCallback(async (code: string, factor: number | null) => {
    const f = factor ?? 1;
    const conv = (n: number | undefined) => (n == null ? n : Math.round(n * f * 100) / 100);
    const next: Settings = {
      ...settings, currency: code,
      monthlyBudget: conv(settings.monthlyBudget),
      budgets: Object.fromEntries(Object.entries(settings.budgets).map(([k, v]) => [k, conv(v)!])),
      accounts: settings.accounts.map((a) => ({ ...a, openingBalance: conv(a.openingBalance)! })),
    };
    const txs = factor ? transactions.map((t) => ({ ...t, amount: conv(t.amount)!, ...(t.rate ? { rate: Math.round(t.rate * f * 1e6) / 1e6 } : {}) })) : [];
    const rec = factor ? recurring.map((r) => ({ ...r, amount: conv(r.amount)! })) : [];
    if (demo) { setSettings(next); if (factor) { setTransactions(txs); setRecurring(rec); } return; }
    await guard(async () => {
      if (factor) {
        await commitInBatches([
          ...txs.map((t) => (b: ReturnType<typeof writeBatch>) => b.set(doc(db, ...userPath("transactions", t.id)), t)),
          ...rec.map((r) => (b: ReturnType<typeof writeBatch>) => b.set(doc(db, ...userPath("recurring", r.id)), r)),
        ]);
      }
      await setDoc(doc(db, ...userPath("meta", "settings")), next);
    });
  }, [demo, guard, commitInBatches, userPath, settings, transactions, recurring]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        try { await signInWithRedirect(auth, googleProvider); return; }
        catch (e2) { const c2 = (e2 as { code?: string }).code ?? ""; setError(authMessage(c2, (e2 as Error).message)); return; }
      }
      setError(authMessage(code, (e as Error).message));
    }
  }, []);

  const signOut = useCallback(async () => {
    if (demo) { sessionStorage.removeItem("ve-demo"); location.href = "/"; return; }
    await fbSignOut(auth);
  }, [demo]);

  void loadTick;
  // Formatting and the category list follow settings; set them before children render.
  configureMoney({ currency: settings.currency, showCents: settings.showCents, privacy: settings.privacy });
  setCategoryRegistry(settings.customCategories, settings.hiddenCategories);
  configurePeriods(settings.periods);

  const value: Store = {
    status, demo, sync, error, transactions, recurring, settings, legacy,
    user: demo
      ? { name: "Vihanga (demo)", email: "demo mode" }
      : user ? { name: user.displayName ?? "You", email: user.email ?? "", photo: user.photoURL ?? undefined } : null,
    saveTransaction, deleteTransaction, saveSettings, saveRecurring, deleteRecurring, importLegacy, dismissLegacy, signIn, signOut,
    saveMany, restoreBackup, deleteAllData, changeBaseCurrency,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const newId = uid;
