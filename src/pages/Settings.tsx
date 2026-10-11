import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Pause, Play, Trash2, Plus, LogOut, Download, Monitor, Sun, Moon } from "lucide-react";
import { useStore, newId } from "../data/store";
import { useUI, type Theme } from "../data/ui";
import { CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCategory } from "../lib/categories";
import { money, parseAmount, thisMonth } from "../lib/format";
import type { TxType } from "../lib/types";
import { Avatar, CatTile } from "../components/bits";
import { downloadCSV, toCSV } from "./Transactions";

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

function RecurringForm({ onDone }: { onDone: () => void }) {
  const { saveRecurring } = useStore();
  const { notify } = useUI();
  const [type, setType] = useState<TxType>("expense");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("bills");
  const [day, setDay] = useState(String(Math.min(new Date().getDate(), 28)));
  const [err, setErr] = useState("");
  const cats = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseAmount(amount), d = Number(day);
    if (!note.trim()) return setErr("Give it a name, like “Netflix” or “Rent”.");
    if (!(n > 0)) return setErr("Enter an amount above zero.");
    // If today's already past the day, mark this month as done so it starts next month.
    const today = new Date().getDate();
    const prior = today >= d ? thisMonth() : undefined;
    await saveRecurring({ id: newId(), type, note: note.trim(), amount: n, categoryId: cat, dayOfMonth: d, active: true, lastPosted: prior, createdAt: Date.now() });
    notify(`${note.trim()} will be added on the ${ordinal(d)} of each month`);
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: 12, padding: 16, borderRadius: 14, background: "var(--surface-2)", marginTop: 12 }}>
      <div className="seg full" role="group" aria-label="Type">
        <button type="button" aria-pressed={type === "expense"} onClick={() => { setType("expense"); setCat("bills"); }}>Expense</button>
        <button type="button" aria-pressed={type === "income"} onClick={() => { setType("income"); setCat("salary"); }}>Income</button>
      </div>
      <div className="form-row">
        <div><label className="label" htmlFor="r-note">Name</label><input id="r-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rent" maxLength={60} /></div>
        <div><label className="label" htmlFor="r-amt">Amount (Rs)</label><input id="r-amt" className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" /></div>
      </div>
      <div className="form-row">
        <div><label className="label" htmlFor="r-cat">Category</label>
          <select id="r-cat" className="select" value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="r-day">Day of month</label>
          <select id="r-day" className="select" value={day} onChange={(e) => setDay(e.target.value)}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{ordinal(i + 1)}</option>)}</select></div>
      </div>
      {err && <p className="form-error" style={{ margin: 0 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8 }}><button className="btn" type="submit">Save recurring</button><button className="btn ghost" type="button" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

export default function Settings() {
  const { user, settings, saveSettings, recurring, saveRecurring, deleteRecurring, transactions, signOut, demo } = useStore();
  const { theme, setTheme, notify } = useUI();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(settings.displayName ?? "");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const loc = useLocation();

  useEffect(() => { setName(settings.displayName ?? ""); }, [settings.displayName]);
  useEffect(() => {
    if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ block: "start" }), 50);
  }, [loc.hash]);

  const recList = [...recurring].sort((a, b) => Number(b.active) - Number(a.active) || a.dayOfMonth - b.dayOfMonth);
  const monthlyOut = recurring.filter((r) => r.active && r.type === "expense").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head"><div><h1>Settings</h1><p>Your account, recurring items and data.</p></div></div>

      <section className="card">
        <div className="card-head"><h2>Account</h2></div>
        <div className="settings-list">
          <div className="set-row">
            <span style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, flex: "1 1 220px" }}>
              <Avatar />
              <span className="t"><b>{user?.name}</b><small>{user?.email}</small></span>
            </span>
            <button className="btn secondary sm" onClick={() => void signOut()}><LogOut />{demo ? "Leave demo" : "Sign out"}</button>
          </div>
          <form className="set-row" onSubmit={(e) => { e.preventDefault(); void saveSettings({ displayName: name.trim() }); notify("Name saved"); }}>
            <span className="t"><b>What should we call you?</b><small>Used in the greeting on the overview.</small></span>
            <span style={{ display: "flex", gap: 8 }}>
              <input id="s-name" className="input" style={{ width: 180, height: 38 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vihanga" aria-label="Display name" maxLength={40} />
              <button className="btn sm" type="submit" style={{ height: 38 }}>Save</button>
            </span>
          </form>
          <div className="set-row">
            <span className="t"><b>Appearance</b><small>Follow your device or pick one.</small></span>
            <div className="seg" role="group" aria-label="Theme">
              {([["system", Monitor, "Auto"], ["light", Sun, "Light"], ["dark", Moon, "Dark"]] as [Theme, typeof Sun, string][]).map(([t, Icon, label]) => (
                <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon size={15} />{label}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card" id="recurring">
        <div className="card-head">
          <h2>Recurring</h2>
          <span className="meta">{monthlyOut ? `${money(monthlyOut)} goes out every month` : "Bills and income that repeat monthly"}</span>
        </div>
        {recList.length === 0 && !adding && <p style={{ margin: 0, color: "var(--muted)" }}>Add rent, subscriptions or your salary once, and they'll be recorded automatically each month.</p>}
        <div>
          {recList.map((r) => (
            <div className={`rec-row ${r.active ? "" : "paused"}`} key={r.id}>
              <CatTile id={r.categoryId} size="sm" />
              <span style={{ minWidth: 0 }}>
                <b>{r.note}</b>
                <small>{getCategory(r.categoryId).name} · {r.active ? `${ordinal(r.dayOfMonth)} of each month` : "Paused"}</small>
              </span>
              <span className={`amt ${r.type === "income" ? "in" : ""}`}>{r.type === "income" ? "+" : "−"}{money(r.amount)}</span>
              {confirmDel === r.id ? (
                <span style={{ display: "flex", gap: 6 }}>
                  <button className="btn danger sm" onClick={async () => { setConfirmDel(null); await deleteRecurring(r.id); notify(`${r.note} removed`); }}>Remove</button>
                  <button className="btn secondary sm" onClick={() => setConfirmDel(null)}>Keep</button>
                </span>
              ) : (
                <span style={{ display: "flex", gap: 2 }}>
                  <button className="icon-btn plain" onClick={() => void saveRecurring({ ...r, active: !r.active })} aria-label={r.active ? `Pause ${r.note}` : `Resume ${r.note}`}>{r.active ? <Pause /> : <Play />}</button>
                  <button className="icon-btn plain" onClick={() => setConfirmDel(r.id)} aria-label={`Remove ${r.note}`}><Trash2 /></button>
                </span>
              )}
            </div>
          ))}
        </div>
        {adding ? <RecurringForm onDone={() => setAdding(false)} /> : (
          <button className="btn secondary sm" style={{ marginTop: 12 }} onClick={() => setAdding(true)}><Plus />Add recurring item</button>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2>Your data</h2></div>
        <div className="settings-list">
          <div className="set-row">
            <span className="t"><b>Export everything</b><small>{transactions.length} transactions as a CSV file for Excel or Google Sheets.</small></span>
            <button className="btn secondary sm" disabled={!transactions.length} onClick={() => downloadCSV("vihanga-expenses-all.csv", toCSV(transactions))}><Download />Export CSV</button>
          </div>
          <div className="set-row">
            <span className="t"><b>Categories</b><small>{CATEGORIES.filter((c) => c.type === "expense").length} expense and {CATEGORIES.filter((c) => c.type === "income").length} income categories.</small></span>
          </div>
          <div className="set-row">
            <span className="t"><b>Shortcuts</b><small>Press N to add an expense, I to add income.</small></span>
          </div>
        </div>
      </section>
    </div>
  );
}
