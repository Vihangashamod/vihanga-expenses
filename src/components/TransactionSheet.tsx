import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { useStore, newId } from "../data/store";
import { useUI } from "../data/ui";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCategory } from "../lib/categories";
import { money, parseAmount, thisMonth, todayISO } from "../lib/format";
import type { Transaction, TxType } from "../lib/types";
import { CatTile } from "./bits";

export function TransactionSheet() {
  const { sheet, closeSheet } = useUI();
  if (!sheet.open) return null;
  return <SheetBody key={sheet.tx?.id ?? `new-${sheet.type ?? "expense"}`} tx={sheet.tx} initialType={sheet.type} onClose={closeSheet} />;
}

function SheetBody({ tx, initialType, onClose }: { tx?: Transaction; initialType?: TxType; onClose: () => void }) {
  const { saveTransaction, deleteTransaction, saveRecurring, transactions } = useStore();
  const { notify, month, setMonth } = useUI();
  const editing = !!tx;
  const defaultDate = month === thisMonth() || month > thisMonth() ? todayISO() : `${month}-01`;
  const [type, setType] = useState<TxType>(tx?.type ?? initialType ?? "expense");
  const [amount, setAmount] = useState(tx ? String(tx.amount) : "");
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? (initialType === "income" ? "salary" : "groceries"));
  const [note, setNote] = useState(tx?.note ?? "");
  const [date, setDate] = useState(tx?.date ?? defaultDate);
  const [repeat, setRepeat] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const userPickedCat = useRef(editing);

  const cats = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  useEffect(() => {
    const t = window.setTimeout(() => amountRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const switchType = (t: TxType) => {
    setType(t);
    if (getCategory(categoryId).type !== t) setCategoryId(t === "income" ? "salary" : "groceries");
  };

  // Notes you've used before, most recent first, for this type
  const suggestions = useMemo(() => {
    const seen = new Map<string, Transaction>();
    [...transactions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).forEach((t) => {
      if (t.type === type && t.note && !seen.has(t.note.toLowerCase())) seen.set(t.note.toLowerCase(), t);
    });
    return [...seen.values()].slice(0, 60);
  }, [transactions, type]);

  const onNote = (v: string) => {
    setNote(v);
    if (editing) return;
    const match = suggestions.find((s) => s.note.toLowerCase() === v.trim().toLowerCase());
    if (match) {
      if (!userPickedCat.current) setCategoryId(match.categoryId);
      if (!amount) setAmount(String(match.amount));
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseAmount(amount);
    if (!(n > 0)) { setErr("Enter an amount above zero."); amountRef.current?.focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr("Choose a date."); return; }
    setBusy(true);
    const rid = repeat && !editing ? newId() : tx?.recurringId;
    const t: Transaction = {
      id: tx?.id ?? newId(), type, amount: n, categoryId, note: note.trim(), date,
      createdAt: tx?.createdAt ?? Date.now(), ...(rid ? { recurringId: rid } : {}),
    };
    try {
      // Writes are applied locally at once; don't block the UI waiting for the server.
      const writes = [saveTransaction(t)];
      if (repeat && !editing && rid) {
        writes.push(saveRecurring({ id: rid, type, amount: n, categoryId, note: t.note || getCategory(categoryId).name,
          dayOfMonth: Math.min(Number(date.slice(8, 10)), 28), active: true, lastPosted: date.slice(0, 7), createdAt: Date.now() }));
      }
      onClose();
      if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7));
      notify(editing ? "Changes saved" : `${type === "income" ? "Income" : "Expense"} added · ${money(n)}`);
      await Promise.all(writes);
    } catch (e2) {
      setBusy(false);
      setErr(`Couldn't save: ${(e2 as Error).message}`);
    }
  };

  const remove = async () => {
    if (!tx) return;
    onClose();
    await deleteTransaction(tx.id);
    notify("Transaction deleted", { label: "Undo", run: () => { void saveTransaction(tx); } });
  };

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onSubmit={save} noValidate>
        <div className="grab" />
        <div className="sheet-head">
          <h2 id="sheet-title">{editing ? "Edit transaction" : "New transaction"}</h2>
          <button type="button" className="icon-btn plain" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <div className="seg full" role="group" aria-label="Type">
          <button type="button" aria-pressed={type === "expense"} onClick={() => switchType("expense")}>Expense</button>
          <button type="button" aria-pressed={type === "income"} onClick={() => switchType("income")}>Income</button>
        </div>

        <label className="amount-field">
          <span>Rs</span>
          <input
            id="tx-amount" ref={amountRef} inputMode="decimal" autoComplete="off" placeholder="0" aria-label="Amount in rupees"
            value={amount} style={{ width: `${Math.max(amount.length, 1) + 0.6}ch` }} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.,]/g, "")); setErr(""); }}
          />
        </label>

        <span className="label" id="cat-label">Category</span>
        <div className="cat-grid" role="radiogroup" aria-labelledby="cat-label">
          {cats.map((c) => (
            <button
              type="button" key={c.id} role="radio" aria-checked={categoryId === c.id} className="cat-opt"
              onClick={() => { setCategoryId(c.id); userPickedCat.current = true; }}
            >
              <CatTile id={c.id} size="sm" />
              {c.name}
            </button>
          ))}
        </div>

        <div className="field">
          <label className="label" htmlFor="tx-note">Note</label>
          <input id="tx-note" className="input" list="tx-notes" autoComplete="off" maxLength={80}
            placeholder={type === "expense" ? "e.g. Keells weekly shop" : "e.g. October salary"} value={note} onChange={(e) => onNote(e.target.value)} />
          <datalist id="tx-notes">{suggestions.map((s) => <option key={s.id} value={s.note} />)}</datalist>
        </div>

        <div className="field">
          <label className="label" htmlFor="tx-date">Date</label>
          <input id="tx-date" className="input" type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} />
        </div>

        {!editing && (
          <div className="toggle">
            <span>Repeat every month<small>Adds it automatically on day {Math.min(Number(date.slice(8, 10)) || 1, 28)}.</small></span>
            <button type="button" className="switch" role="switch" aria-checked={repeat} aria-label="Repeat every month" onClick={() => setRepeat((r) => !r)} />
          </div>
        )}

        {err && <p className="form-error" role="alert">{err}</p>}

        {confirmDel ? (
          <div className="confirm-box">
            <span>Delete this transaction?</span>
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn danger sm" onClick={remove}>Delete</button>
              <button type="button" className="btn secondary sm" onClick={() => setConfirmDel(false)}>Keep</button>
            </span>
          </div>
        ) : (
          <div className="sheet-actions">
            <button type="submit" className="btn" disabled={busy}>{editing ? "Save changes" : `Add ${type}`}</button>
            {editing && (
              <button type="button" className="btn secondary" onClick={() => setConfirmDel(true)} aria-label="Delete transaction"><Trash2 /></button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
