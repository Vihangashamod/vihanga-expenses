import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Trash2, X } from "lucide-react";
import { useStore, newId } from "../data/store";
import { useUI, type SheetPreset } from "../data/ui";
import { getCategory, pickable } from "../lib/categories";
import { CURRENCIES, getCurrency, rateToBase } from "../lib/currency";
import { money, parseAmount, todayISO } from "../lib/format";
import { currentPeriodKey, inPeriod, periodKeyFor, periodOf } from "../lib/period";
import type { CatType, Transaction, TxType } from "../lib/types";
import { CatTile } from "./bits";
import { AccountIcon } from "./AccountIcon";

export function TransactionSheet() {
  const { sheet, closeSheet } = useUI();
  if (!sheet.open) return null;
  return <SheetBody key={sheet.tx?.id ?? `new-${sheet.type ?? "expense"}`} tx={sheet.tx} initialType={sheet.type} preset={sheet.preset} onClose={closeSheet} />;
}

function SheetBody({ tx, initialType, preset, onClose }: { tx?: Transaction; initialType?: TxType; preset?: SheetPreset; onClose: () => void }) {
  const { saveTransaction, deleteTransaction, saveRecurring, transactions, settings } = useStore();
  const { notify, month, setMonth } = useUI();
  const base = settings.currency;
  const accounts = settings.accounts.filter((a) => !a.archived || a.id === tx?.accountId || a.id === tx?.toAccountId);
  const defaultAcc = accounts.find((a) => a.id === settings.defaultAccountId)?.id ?? accounts[0]?.id ?? "";
  const editing = !!tx;
  const period = periodOf(month);
  const defaultDate = inPeriod(period, todayISO()) ? todayISO() : month > currentPeriodKey() ? period.start : period.end;

  const [type, setType] = useState<TxType>(tx?.type ?? initialType ?? "expense");
  const [currency, setCurrency] = useState(tx?.originalCurrency ?? base);
  const [amount, setAmount] = useState(tx ? String(tx.originalAmount ?? tx.amount) : preset?.amount ? String(Math.round(preset.amount * 100) / 100) : "");
  const [rate, setRate] = useState(tx?.rate ? String(tx.rate) : "");
  const [rateState, setRateState] = useState<"idle" | "loading" | "live" | "manual" | "failed">(tx?.rate ? "manual" : "idle");
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? preset?.categoryId ?? (initialType === "income" ? "salary" : "groceries"));
  const startAcc = tx?.accountId ?? preset?.accountId ?? defaultAcc;
  const [accountId, setAccountId] = useState(startAcc);
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId ?? preset?.toAccountId ?? accounts.find((a) => a.id !== startAcc)?.id ?? "");
  const [note, setNote] = useState(tx?.note ?? preset?.note ?? "");
  const [date, setDate] = useState(tx?.date ?? defaultDate);
  const [repeat, setRepeat] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const userPickedCat = useRef(editing);

  const foreign = currency !== base;
  const cats = type === "transfer" ? [] : pickable(type as CatType);
  // Keep a category that's been hidden since, so editing old entries works.
  if (tx && type !== "transfer" && !cats.some((c) => c.id === categoryId) && getCategory(categoryId).type === type) cats.push(getCategory(categoryId));

  useEffect(() => {
    const t = window.setTimeout(() => amountRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  // Look up a live rate when a foreign currency is picked (unless one was typed).
  useEffect(() => {
    if (!foreign) { setRateState("idle"); return; }
    if (rateState === "manual" && rate) return;
    let cancelled = false;
    setRateState("loading");
    rateToBase(currency, base).then((r) => {
      if (cancelled) return;
      if (r) { setRate(String(+r.toFixed(r < 1 ? 6 : 4))); setRateState("live"); }
      else setRateState("failed");
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, base]);

  const switchType = (t: TxType) => {
    setType(t);
    if (t !== "transfer" && getCategory(categoryId).type !== t) setCategoryId(t === "income" ? "salary" : "groceries");
    if (t === "transfer") { setCurrency(base); if (toAccountId === accountId) setToAccountId(accounts.find((a) => a.id !== accountId)?.id ?? ""); }
  };

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
      if (!userPickedCat.current && type !== "transfer") setCategoryId(match.categoryId);
      if (match.accountId && accounts.some((a) => a.id === match.accountId)) setAccountId(match.accountId);
      if (!amount) {
        if (match.originalCurrency) { setCurrency(match.originalCurrency); setAmount(String(match.originalAmount)); }
        else setAmount(String(match.amount));
      }
    }
  };

  const n = parseAmount(amount);
  const r = foreign ? parseAmount(rate) : 1;
  const converted = n > 0 && r > 0 ? Math.round(n * r * 100) / 100 : 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(n > 0)) { setErr("Enter an amount above zero."); amountRef.current?.focus(); return; }
    if (foreign && !(r > 0)) { setErr(`Enter the exchange rate: how many ${base} one ${currency} is worth.`); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr("Choose a date."); return; }
    if (type === "transfer" && (!accountId || !toAccountId || accountId === toAccountId)) { setErr("Pick two different accounts for a transfer."); return; }
    setBusy(true);
    const rid = repeat && !editing && type !== "transfer" ? newId() : tx?.recurringId;
    const t: Transaction = {
      id: tx?.id ?? newId(), type, amount: converted, categoryId: type === "transfer" ? "transfer" : categoryId,
      note: note.trim(), date, createdAt: tx?.createdAt ?? Date.now(),
      ...(accountId ? { accountId } : {}),
      ...(type === "transfer" ? { toAccountId } : {}),
      ...(foreign ? { originalCurrency: currency, originalAmount: n, rate: r } : {}),
      ...(rid ? { recurringId: rid } : {}),
    };
    try {
      const writes = [saveTransaction(t)];
      if (repeat && !editing && rid && type !== "transfer") {
        writes.push(saveRecurring({ id: rid, type: type as CatType, amount: converted, categoryId, note: t.note || getCategory(categoryId).name, accountId,
          dayOfMonth: Math.min(Number(date.slice(8, 10)), 28), active: true, lastPosted: date.slice(0, 7), createdAt: Date.now() }));
      }
      onClose();
      if (periodKeyFor(date) !== month) setMonth(periodKeyFor(date));
      const label = type === "income" ? "Income added" : type === "transfer" ? "Transfer saved" : "Expense added";
      notify(editing ? "Changes saved" : `${label} · ${foreign ? `${money(n, { currency, exact: true })} = ` : ""}${money(converted)}`);
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

  const favs = [base, ...settings.favoriteCurrencies.filter((c) => c !== base)];
  const curOptions = [...favs.map(getCurrency), ...CURRENCIES.filter((c) => !favs.includes(c.code))];

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
          {accounts.length > 1 && <button type="button" aria-pressed={type === "transfer"} onClick={() => switchType("transfer")}>Transfer</button>}
        </div>

        <div className="amount-field">
          {type !== "transfer" ? (
            <select className="cur-select" value={currency} onChange={(e) => { setCurrency(e.target.value); setRateState("idle"); setErr(""); }} aria-label="Currency">
              {curOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          ) : <span>{getCurrency(base).symbol}</span>}
          <input
            id="tx-amount" ref={amountRef} onFocus={(e) => e.currentTarget.select()} inputMode="decimal" autoComplete="off" placeholder="0" aria-label={`Amount in ${currency}`}
            value={amount} style={{ width: `${Math.max(amount.length, 1) + 0.6}ch` }}
            onChange={(e) => { setAmount(e.target.value.replace(/[^\d.,]/g, "")); setErr(""); }}
          />
        </div>

        {foreign && (
          <div className="fx">
            <label htmlFor="tx-rate">1 {currency} =</label>
            <input id="tx-rate" className="input" inputMode="decimal" value={rate} placeholder={rateState === "loading" ? "Loading…" : "Rate"}
              onChange={(e) => { setRate(e.target.value.replace(/[^\d.,]/g, "")); setRateState("manual"); }} />
            <span>{base}</span>
            <small>
              {rateState === "live" ? "Today's rate" : rateState === "loading" ? "Getting today's rate…" : rateState === "failed" ? "Couldn't get a live rate. Type it in." : "Your rate"}
              {converted > 0 && <> · <b>{money(converted, { exact: true })}</b></>}
            </small>
          </div>
        )}

        {type === "transfer" ? (
          <div className="transfer">
            <AccountPicker label="From" value={accountId} onChange={setAccountId} accounts={accounts} />
            <span className="transfer-arrow" aria-hidden="true"><ArrowDown /></span>
            <AccountPicker label="To" value={toAccountId} onChange={setToAccountId} accounts={accounts.filter((a) => a.id !== accountId)} />
          </div>
        ) : (
          <>
            <span className="label" id="cat-label">Category</span>
            <div className="cat-grid" role="radiogroup" aria-labelledby="cat-label">
              {cats.map((c) => (
                <button type="button" key={c.id} role="radio" aria-checked={categoryId === c.id} className="cat-opt"
                  onClick={() => { setCategoryId(c.id); userPickedCat.current = true; }}>
                  <CatTile id={c.id} size="sm" />
                  {c.name}
                </button>
              ))}
            </div>
            {accounts.length > 1 && (
              <div className="field">
                <span className="label" id="acc-label">{type === "income" ? "Paid into" : "Paid from"}</span>
                <div className="chips" role="radiogroup" aria-labelledby="acc-label">
                  {accounts.filter((a) => !a.archived || a.id === accountId).map((a) => (
                    <button type="button" key={a.id} role="radio" aria-checked={accountId === a.id} className="chip-opt" onClick={() => setAccountId(a.id)}>
                      <AccountIcon kind={a.kind} color={a.color} size={14} />{a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="form-row field">
          <div>
            <label className="label" htmlFor="tx-note">Note</label>
            <input id="tx-note" className="input" list="tx-notes" autoComplete="off" maxLength={80}
              placeholder={type === "expense" ? "e.g. Keells weekly shop" : type === "income" ? "e.g. October salary" : "e.g. ATM withdrawal"}
              value={note} onChange={(e) => onNote(e.target.value)} />
            <datalist id="tx-notes">{suggestions.map((s) => <option key={s.id} value={s.note} />)}</datalist>
          </div>
          <div>
            <label className="label" htmlFor="tx-date">Date</label>
            <input id="tx-date" className="input" type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {!editing && type !== "transfer" && (
          <div className="toggle">
            <span>Repeat every month<small>Adds it automatically on day {Math.min(Number(date.slice(8, 10)) || 1, 28)}.</small></span>
            <button type="button" className="switch" role="switch" aria-checked={repeat} aria-label="Repeat every month" onClick={() => setRepeat((v) => !v)} />
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
            {editing && <button type="button" className="btn secondary" onClick={() => setConfirmDel(true)} aria-label="Delete transaction"><Trash2 /></button>}
          </div>
        )}
      </form>
    </div>
  );
}

function AccountPicker({ label, value, onChange, accounts }: {
  label: string; value: string; onChange: (id: string) => void; accounts: { id: string; name: string; kind: import("../lib/types").AccountKind; color: string }[];
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="chips" role="radiogroup" aria-label={`${label} account`}>
        {accounts.map((a) => (
          <button type="button" key={a.id} role="radio" aria-checked={value === a.id} className="chip-opt" onClick={() => onChange(a.id)}>
            <AccountIcon kind={a.kind} color={a.color} size={14} />{a.name}
          </button>
        ))}
      </div>
    </div>
  );
}
