import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Pause, Play, Trash2, Plus, LogOut, Download, Upload, Monitor, Sun, Moon, Eye, EyeOff, Pencil } from "lucide-react";
import { useStore, newId, type Backup } from "../data/store";
import { useUI, type Theme } from "../data/ui";
import { ICONS, PALETTE, allOf, getCategory, isHidden, pickable } from "../lib/categories";
import { CURRENCIES, fetchRates, getCurrency } from "../lib/currency";
import { currencySymbol, money, monthLabel as monthLabelFn, parseAmount, shortDate, thisMonth } from "../lib/format";

const fmtDay = (iso: string) => shortDate(iso, true);
import type { CatType, CustomCategory, Recurring } from "../lib/types";
import { Avatar, CatTile } from "../components/bits";
import { downloadCSV, toCSV } from "./Transactions";

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Recurring ---------- */
function RecurringForm({ initial, onDone }: { initial?: Recurring; onDone: () => void }) {
  const { saveRecurring, settings } = useStore();
  const { notify } = useUI();
  const [type, setType] = useState<CatType>(initial?.type ?? "expense");
  const [note, setNote] = useState(initial?.note ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [cat, setCat] = useState(initial?.categoryId ?? "bills");
  const [acc, setAcc] = useState(initial?.accountId ?? settings.defaultAccountId ?? settings.accounts[0]?.id ?? "");
  const [day, setDay] = useState(String(initial?.dayOfMonth ?? Math.min(new Date().getDate(), 28)));
  const [err, setErr] = useState("");
  const cats = pickable(type);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseAmount(amount), d = Number(day);
    if (!note.trim()) return setErr("Give it a name, like “Netflix” or “Rent”.");
    if (!(n > 0)) return setErr("Enter an amount above zero.");
    const today = new Date().getDate();
    const lastPosted = initial?.lastPosted ?? (today >= d ? thisMonth() : undefined);
    await saveRecurring({ id: initial?.id ?? newId(), type, note: note.trim(), amount: n, categoryId: cat, accountId: acc || undefined,
      dayOfMonth: d, active: initial?.active ?? true, lastPosted, createdAt: initial?.createdAt ?? Date.now() });
    notify(initial ? `${note.trim()} updated` : `${note.trim()} will be added on the ${ordinal(d)} of each month`);
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="panel">
      <div className="seg full" role="group" aria-label="Type">
        <button type="button" aria-pressed={type === "expense"} onClick={() => { setType("expense"); setCat("bills"); }}>Expense</button>
        <button type="button" aria-pressed={type === "income"} onClick={() => { setType("income"); setCat("salary"); }}>Income</button>
      </div>
      <div className="form-row">
        <div><label className="label" htmlFor="r-note">Name</label><input id="r-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rent" maxLength={60} /></div>
        <div><label className="label" htmlFor="r-amt">Amount ({currencySymbol()})</label><input id="r-amt" className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" /></div>
      </div>
      <div className="form-row">
        <div><label className="label" htmlFor="r-cat">Category</label>
          <select id="r-cat" className="select" value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="r-day">Day of month</label>
          <select id="r-day" className="select" value={day} onChange={(e) => setDay(e.target.value)}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{ordinal(i + 1)}</option>)}</select></div>
      </div>
      {settings.accounts.length > 1 && (
        <div><label className="label" htmlFor="r-acc">{type === "income" ? "Paid into" : "Paid from"}</label>
          <select id="r-acc" className="select" value={acc} onChange={(e) => setAcc(e.target.value)}>{settings.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      )}
      {err && <p className="form-error" style={{ margin: 0 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8 }}><button className="btn" type="submit">{initial ? "Save" : "Add recurring"}</button><button className="btn ghost" type="button" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

/* ---------- Custom category ---------- */
function CategoryForm({ initial, onDone }: { initial?: CustomCategory; onDone: () => void }) {
  const { settings, saveSettings } = useStore();
  const { notify } = useUI();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<CatType>(initial?.type ?? "expense");
  const [icon, setIcon] = useState(initial?.icon ?? "tag");
  const [color, setColor] = useState(initial?.color ?? PALETTE[8]);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr("Give the category a name.");
    const c: CustomCategory = { id: initial?.id ?? `c_${newId().slice(0, 8)}`, name: name.trim(), type, icon, color };
    const list = initial ? settings.customCategories.map((x) => (x.id === c.id ? c : x)) : [...settings.customCategories, c];
    await saveSettings({ customCategories: list });
    notify(initial ? `${c.name} updated` : `${c.name} added`);
    onDone();
  };
  const Icon = ICONS[icon];
  return (
    <form className="panel" onSubmit={submit} noValidate>
      {!initial && (
        <div className="seg full" role="group" aria-label="Type">
          <button type="button" aria-pressed={type === "expense"} onClick={() => setType("expense")}>Expense</button>
          <button type="button" aria-pressed={type === "income"} onClick={() => setType("income")}>Income</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
        <span className="cat-tile" style={{ background: `${color}1F`, color }} aria-hidden="true">{Icon && <Icon />}</span>
        <div style={{ flex: 1 }}><label className="label" htmlFor="c-name">Name</label>
          <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pets, Gym, Temple" maxLength={30} autoFocus /></div>
      </div>
      <div>
        <span className="label">Icon</span>
        <div className="icon-grid" role="radiogroup" aria-label="Icon">
          {Object.entries(ICONS).map(([k, I]) => (
            <button type="button" key={k} role="radio" aria-checked={icon === k} aria-label={k} className="icon-pick" onClick={() => setIcon(k)}><I /></button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Colour</span>
        <div className="swatches" role="radiogroup" aria-label="Colour">
          {PALETTE.map((c) => <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} className="swatch" style={{ background: c }} onClick={() => setColor(c)} />)}
        </div>
      </div>
      {err && <p className="form-error" style={{ margin: 0 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8 }}><button className="btn" type="submit">{initial ? "Save" : "Add category"}</button><button className="btn ghost" type="button" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

/* ---------- Base currency change ---------- */
function CurrencyChange({ to, onDone }: { to: string; onDone: () => void }) {
  const { settings, changeBaseCurrency, transactions } = useStore();
  const { notify } = useUI();
  const from = settings.currency;
  const [factor, setFactor] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetchRates(from).then((t) => {
      const r = t?.rates[to];
      if (r) { setFactor(String(+r.toPrecision(6))); setState("ready"); } else setState("failed");
    });
  }, [from, to]);
  const f = parseAmount(factor);
  const run = async (convert: boolean) => {
    setBusy(true);
    await changeBaseCurrency(to, convert ? f : null);
    notify(convert ? `Converted everything to ${to}` : `Currency set to ${to}`);
    onDone();
  };
  return (
    <div className="panel">
      <b style={{ fontWeight: 600 }}>Switch from {from} to {to}?</b>
      <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
        Your {transactions.length} transactions, budgets and balances are stored in {from}. Convert them at this rate, or keep the numbers and only change the currency label.
      </span>
      <div className="fx" style={{ margin: 0, background: "var(--surface)" }}>
        <label htmlFor="cc-rate">1 {from} =</label>
        <input id="cc-rate" className="input" onFocus={(e) => e.currentTarget.select()} inputMode="decimal" value={factor} placeholder={state === "loading" ? "Loading…" : "Rate"} onChange={(e) => setFactor(e.target.value.replace(/[^\d.,]/g, ""))} />
        <span>{to}</span>
        <small>{state === "loading" ? "Getting today's rate…" : state === "failed" ? "Couldn't get a live rate. Type it in." : "Today's rate. You can change it."}{f > 0 && <> · e.g. {money(10000, { currency: from, reveal: true })} becomes {money(10000 * f, { currency: to, reveal: true })}</>}</small>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" disabled={!(f > 0) || busy} onClick={() => run(true)}>Convert everything</button>
        <button className="btn secondary" disabled={busy} onClick={() => run(false)}>Only change the label</button>
        <button className="btn ghost" disabled={busy} onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

export default function Settings() {
  const store = useStore();
  const { user, settings, saveSettings, recurring, saveRecurring, deleteRecurring, transactions, signOut, demo, restoreBackup, deleteAllData, legacy, importLegacy } = store;
  const { theme, setTheme, notify } = useUI();
  const [adding, setAdding] = useState<null | "rec" | "cat">(null);
  const [editRec, setEditRec] = useState<string | null>(null);
  const [editCat, setEditCat] = useState<string | null>(null);
  const [newBase, setNewBase] = useState<string | null>(null);
  const [name, setName] = useState(settings.displayName ?? "");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [wipe, setWipe] = useState("");
  const [restore, setRestore] = useState<Backup | null>(null);
  const [catTab, setCatTab] = useState<CatType>("expense");
  const fileRef = useRef<HTMLInputElement>(null);
  const loc = useLocation();

  useEffect(() => { setName(settings.displayName ?? ""); }, [settings.displayName]);
  useEffect(() => {
    if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ block: "start" }), 50);
  }, [loc.hash]);

  const recList = [...recurring].sort((a, b) => Number(b.active) - Number(a.active) || a.dayOfMonth - b.dayOfMonth);
  const monthlyOut = recurring.filter((r) => r.active && r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const usage = (id: string) => transactions.filter((t) => t.categoryId === id).length;

  const toggleHidden = (id: string) => {
    const set = new Set(settings.hiddenCategories);
    if (set.has(id)) set.delete(id); else set.add(id);
    void saveSettings({ hiddenCategories: [...set] });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as Backup;
      if (data.app !== "vihanga-expenses" || !Array.isArray(data.transactions)) throw new Error("not a backup");
      setRestore(data);
    } catch {
      notify("That file isn't a Vihanga's Expenses backup. Choose a .json file made with “Download backup”.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const backup = () => {
    const b: Backup = { app: "vihanga-expenses", version: 2, exportedAt: new Date().toISOString(), transactions, recurring, settings };
    download(`vihanga-expenses-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 2), "application/json");
  };

  const accName = (id?: string) => settings.accounts.find((a) => a.id === id)?.name;
  const catsShown = allOf(catTab);

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <div className="page-head"><div><h1>Settings</h1><p>Your account, currency, categories, recurring items and data.</p></div></div>

      <nav className="settings-nav" aria-label="Settings sections">
        <a href="#profile">Profile</a><a href="#currency">Currency</a><a href="#leftover">Months</a><a href="#display">Display</a>
        <a href="#categories">Categories</a><a href="#recurring">Recurring</a><a href="#data">Data</a>
      </nav>

      <section className="card" id="profile">
        <div className="card-head"><h2>Profile</h2></div>
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
              <input id="s-name" className="input" style={{ width: 170, height: 38 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vihanga" aria-label="Display name" maxLength={40} />
              <button className="btn sm" type="submit" style={{ height: 38 }}>Save</button>
            </span>
          </form>
        </div>
      </section>

      <section className="card" id="currency">
        <div className="card-head"><h2>Currency</h2><span className="meta">{getCurrency(settings.currency).name}</span></div>
        <div className="settings-list">
          <div className="set-row">
            <span className="t"><b>Main currency</b><small>Totals, budgets and charts use this. Spending in other currencies is converted when you add it.</small></span>
            <select id="s-cur" className="select" style={{ width: 230 }} value={newBase ?? settings.currency}
              onChange={(e) => setNewBase(e.target.value === settings.currency ? null : e.target.value)} aria-label="Main currency">
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </select>
          </div>
          {newBase && <CurrencyChange to={newBase} onDone={() => setNewBase(null)} />}
          <div className="set-row">
            <span className="t"><b>Quick currencies</b><small>Shown first when you add a transaction. Tap to add or remove.</small></span>
            <div className="chips" style={{ maxWidth: 380 }}>
              {["USD", "EUR", "GBP", "INR", "AED", "AUD", "SGD", "JPY", "MVR", "SAR", "QAR", "CAD"].filter((c) => c !== settings.currency).map((c) => {
                const on = settings.favoriteCurrencies.includes(c);
                return (
                  <button key={c} type="button" role="switch" aria-checked={on} className="chip-opt" onClick={() =>
                    void saveSettings({ favoriteCurrencies: on ? settings.favoriteCurrencies.filter((x) => x !== c) : [...settings.favoriteCurrencies, c] })}>
                    {getCurrency(c).symbol === c ? c : `${getCurrency(c).symbol} ${c}`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="card" id="leftover">
        <div className="card-head"><h2>Months & leftover money</h2></div>
        <div className="settings-list">
          <div className="set-row" style={{ alignItems: "flex-start" }}>
            <span className="t"><b>Money left at the end of a month</b>
              <small>{settings.leftover === "carry" ? "Rolls into next month's “left to spend”. Overspending is taken off next month."
                : settings.leftover === "save" ? "Counted as savings and shown in its own section on the overview."
                : "Each month starts fresh."}</small></span>
            <div className="seg" role="group" aria-label="Leftover money">
              <button aria-pressed={settings.leftover === "carry"} onClick={() => void saveSettings({ leftover: "carry" })}>Carry over</button>
              <button aria-pressed={settings.leftover === "save"} onClick={() => void saveSettings({ leftover: "save" })}>Save it</button>
              <button aria-pressed={settings.leftover === "none"} onClick={() => void saveSettings({ leftover: "none" })}>Nothing</button>
            </div>
          </div>
          <div className="set-row" style={{ alignItems: "flex-start" }}>
            <span className="t"><b>Month dates</b>
              <small>Tap the calendar button beside the month name to choose when a month starts and ends, like 25 Sep – 24 Oct. Later months continue from it.</small></span>
          </div>
          {Object.entries(settings.periods).sort(([a], [b]) => b.localeCompare(a)).map(([mk, r]) => (
            <div className="set-row" key={mk}>
              <span className="t"><b>{monthLabelFn(mk)}</b><small>{fmtDay(r.start)} – {fmtDay(r.end)}</small></span>
              <button className="btn ghost sm" onClick={() => { const next = { ...settings.periods }; delete next[mk]; void saveSettings({ periods: next }); notify(`Removed the dates for ${monthLabelFn(mk)}`); }}>Remove</button>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="display">
        <div className="card-head"><h2>Display</h2></div>
        <div className="settings-list">
          <div className="set-row">
            <span className="t"><b>Appearance</b><small>Follow your device or pick one.</small></span>
            <div className="seg" role="group" aria-label="Theme">
              {([["system", Monitor, "Auto"], ["light", Sun, "Light"], ["dark", Moon, "Dark"]] as [Theme, typeof Sun, string][]).map(([t, Icon, label]) => (
                <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon size={15} />{label}</button>
              ))}
            </div>
          </div>
          <div className="set-row">
            <span className="t"><b>Hide amounts</b><small>Masks every figure, for using the app in public. Tap the eye in the top bar to toggle.</small></span>
            <button type="button" className="switch" role="switch" aria-checked={settings.privacy} aria-label="Hide amounts" onClick={() => void saveSettings({ privacy: !settings.privacy })} />
          </div>
          <div className="set-row">
            <span className="t"><b>Show cents</b><small>Show {getCurrency(settings.currency).symbol} 12,500.50 instead of rounding to {getCurrency(settings.currency).symbol} 12,501.</small></span>
            <button type="button" className="switch" role="switch" aria-checked={settings.showCents} aria-label="Show cents" onClick={() => void saveSettings({ showCents: !settings.showCents })} />
          </div>
          <div className="set-row">
            <span className="t"><b>Week starts on</b><small>Used in the weekday chart on Insights.</small></span>
            <div className="seg" role="group" aria-label="Week starts on">
              <button aria-pressed={settings.weekStart === 1} onClick={() => void saveSettings({ weekStart: 1 })}>Monday</button>
              <button aria-pressed={settings.weekStart === 0} onClick={() => void saveSettings({ weekStart: 0 })}>Sunday</button>
            </div>
          </div>
          <div className="set-row">
            <span className="t"><b>Default account</b><small>Pre-selected when you add a transaction.</small></span>
            <select className="select" style={{ width: 200 }} value={settings.defaultAccountId ?? ""} aria-label="Default account"
              onChange={(e) => void saveSettings({ defaultAccountId: e.target.value })}>
              {settings.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="card" id="categories">
        <div className="card-head">
          <h2>Categories</h2>
          <div className="seg" role="group" aria-label="Category type">
            <button aria-pressed={catTab === "expense"} onClick={() => setCatTab("expense")}>Expenses</button>
            <button aria-pressed={catTab === "income"} onClick={() => setCatTab("income")}>Income</button>
          </div>
        </div>
        <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: 14 }}>Hide the ones you never use. Hidden categories keep their history.</p>
        <div>
          {catsShown.map((c) => {
            const off = isHidden(c.id);
            const custom = settings.customCategories.find((x) => x.id === c.id);
            const n = usage(c.id);
            if (editCat === c.id && custom) return <CategoryForm key={c.id} initial={custom} onDone={() => setEditCat(null)} />;
            return (
              <div className={`cat-row ${off ? "off" : ""}`} key={c.id}>
                <CatTile id={c.id} size="sm" />
                <span style={{ minWidth: 0 }}><b>{c.name}</b><small>{custom ? "Your category · " : ""}{n ? `${n} transaction${n === 1 ? "" : "s"}` : "Not used yet"}</small></span>
                <span style={{ display: "flex", gap: 2 }}>
                  {custom && <button className="icon-btn plain" onClick={() => setEditCat(c.id)} aria-label={`Edit ${c.name}`}><Pencil /></button>}
                  {custom && n === 0 && (
                    confirmDel === c.id
                      ? <button className="btn danger sm" onClick={async () => { setConfirmDel(null); await saveSettings({ customCategories: settings.customCategories.filter((x) => x.id !== c.id) }); notify(`${c.name} removed`); }}>Remove</button>
                      : <button className="icon-btn plain" onClick={() => setConfirmDel(c.id)} aria-label={`Remove ${c.name}`}><Trash2 /></button>
                  )}
                  <button className="icon-btn plain" onClick={() => toggleHidden(c.id)} aria-label={off ? `Show ${c.name}` : `Hide ${c.name}`} title={off ? "Show" : "Hide"}>{off ? <EyeOff /> : <Eye />}</button>
                </span>
              </div>
            );
          })}
        </div>
        {adding === "cat" ? <CategoryForm onDone={() => setAdding(null)} /> : (
          <button className="btn secondary sm" style={{ marginTop: 12 }} onClick={() => setAdding("cat")}><Plus />New category</button>
        )}
      </section>

      <section className="card" id="recurring">
        <div className="card-head">
          <h2>Recurring</h2>
          <span className="meta">{monthlyOut ? `${money(monthlyOut)} goes out every month` : "Bills and income that repeat monthly"}</span>
        </div>
        {recList.length === 0 && adding !== "rec" && <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>Add rent, subscriptions or your salary once, and they'll be recorded automatically each month.</p>}
        <div>
          {recList.map((r) => editRec === r.id ? <RecurringForm key={r.id} initial={r} onDone={() => setEditRec(null)} /> : (
            <div className={`rec-row ${r.active ? "" : "paused"}`} key={r.id}>
              <CatTile id={r.categoryId} size="sm" />
              <span style={{ minWidth: 0 }}>
                <b>{r.note}</b>
                <small>{getCategory(r.categoryId).name} · {r.active ? `${ordinal(r.dayOfMonth)} of each month` : "Paused"}{settings.accounts.length > 1 && accName(r.accountId) ? ` · ${accName(r.accountId)}` : ""}</small>
              </span>
              <span className={`amt ${r.type === "income" ? "in" : ""}`}>{r.type === "income" ? "+" : "−"}{money(r.amount)}</span>
              {confirmDel === r.id ? (
                <span style={{ display: "flex", gap: 6 }}>
                  <button className="btn danger sm" onClick={async () => { setConfirmDel(null); await deleteRecurring(r.id); notify(`${r.note} removed`); }}>Remove</button>
                  <button className="btn secondary sm" onClick={() => setConfirmDel(null)}>Keep</button>
                </span>
              ) : (
                <span style={{ display: "flex", gap: 2 }}>
                  <button className="icon-btn plain" onClick={() => setEditRec(r.id)} aria-label={`Edit ${r.note}`}><Pencil /></button>
                  <button className="icon-btn plain" onClick={() => void saveRecurring({ ...r, active: !r.active })} aria-label={r.active ? `Pause ${r.note}` : `Resume ${r.note}`}>{r.active ? <Pause /> : <Play />}</button>
                  <button className="icon-btn plain" onClick={() => setConfirmDel(r.id)} aria-label={`Remove ${r.note}`}><Trash2 /></button>
                </span>
              )}
            </div>
          ))}
        </div>
        {adding === "rec" ? <RecurringForm onDone={() => setAdding(null)} /> : (
          <button className="btn secondary sm" style={{ marginTop: 12 }} onClick={() => setAdding("rec")}><Plus />Add recurring item</button>
        )}
      </section>

      <section className="card" id="data">
        <div className="card-head"><h2>Your data</h2><span className="meta">{transactions.length} transactions</span></div>
        <div className="settings-list">
          <div className="set-row">
            <span className="t"><b>Import bank SMS alerts</b><small>Paste HNB or other bank alerts, or send them automatically from your iPhone.</small></span>
            <Link className="btn secondary sm" to="/import">Open import</Link>
          </div>
          <div className="set-row">
            <span className="t"><b>Export to a spreadsheet</b><small>Every transaction as CSV, for Excel or Google Sheets.</small></span>
            <button className="btn secondary sm" disabled={!transactions.length} onClick={() => downloadCSV("vihanga-expenses-all.csv", toCSV(transactions, settings.accounts, settings.currency))}><Download />Export CSV</button>
          </div>
          <div className="set-row">
            <span className="t"><b>Backup</b><small>A complete copy of your transactions, recurring items and settings.</small></span>
            <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn secondary sm" onClick={backup}><Download />Download backup</button>
              <button className="btn secondary sm" onClick={() => fileRef.current?.click()}><Upload />Restore</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
            </span>
          </div>
          {restore && (
            <div className="panel">
              <b style={{ fontWeight: 600 }}>Restore {restore.transactions.length} transactions from {new Date(restore.exportedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}?</b>
              <span style={{ fontSize: 14, color: "var(--ink-2)" }}>Entries with the same ID are overwritten, others are added. Your settings are replaced by the ones in the backup.</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={async () => { const n = await restoreBackup(restore); setRestore(null); notify(`Restored ${n} transactions`); }}>Restore</button>
                <button className="btn ghost" onClick={() => setRestore(null)}>Cancel</button>
              </div>
            </div>
          )}
          {legacy && (
            <div className="set-row">
              <span className="t"><b>Old version data</b><small>{legacy.transactions.length} entries found on {legacy.source}.</small></span>
              <button className="btn sm" onClick={async () => notify(`Imported ${await importLegacy()} entries`)}>Import</button>
            </div>
          )}
        </div>
      </section>

      <section className="card danger-zone">
        <div className="card-head"><h2>Delete everything</h2></div>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink-2)" }}>Removes all transactions, recurring items, accounts and settings{demo ? " from this demo" : " from your account"}. Download a backup first if you might want them back.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ maxWidth: 220 }} value={wipe} onChange={(e) => setWipe(e.target.value)} placeholder="Type DELETE to confirm" aria-label="Type DELETE to confirm" />
          <button className="btn danger" disabled={wipe !== "DELETE"} onClick={async () => { setWipe(""); await deleteAllData(); notify("All data deleted"); }}><Trash2 />Delete everything</button>
        </div>
      </section>

      <p style={{ textAlign: "center", color: "var(--faint)", fontSize: 12.5, margin: "4px 0 0" }}>Vihanga's Expenses 2.1 · Shortcuts: N add expense · I add income · T transfer</p>
    </div>
  );
}
