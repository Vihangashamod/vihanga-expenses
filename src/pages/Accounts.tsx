import { useMemo, useState } from "react";
import { ArrowLeftRight, Plus, Star, Archive, ArchiveRestore, Trash2, Wallet } from "lucide-react";
import { useStore, newId } from "../data/store";
import { useUI } from "../data/ui";
import { accountOf, balances } from "../lib/analytics";
import { PALETTE } from "../lib/categories";
import { currencySymbol, money, parseAmount } from "../lib/format";
import type { Account, AccountKind } from "../lib/types";
import { ACCOUNT_KINDS, AccountIcon } from "../components/AccountIcon";
import { TxRow, sortTx } from "../components/TxList";

function AccountForm({ initial, onSave, onCancel, extra }: {
  initial?: Account; onSave: (a: Account) => void; onCancel: () => void; extra?: React.ReactNode;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? "bank");
  const [color, setColor] = useState(initial?.color ?? PALETTE[1]);
  const [opening, setOpening] = useState(initial ? String(initial.openingBalance) : "");
  const [err, setErr] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr("Give the account a name, like “Sampath Bank” or “eZ Cash”.");
    const ob = opening.trim() ? parseAmount(opening.replace(/^−/, "-")) : 0;
    if (Number.isNaN(ob)) return setErr("Enter the starting balance as a number. Use a minus sign for money you owe.");
    onSave({ id: initial?.id ?? newId(), name: name.trim(), kind, color, openingBalance: ob, archived: initial?.archived, createdAt: initial?.createdAt ?? Date.now() });
  };
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <div className="form-row">
        <div><label className="label" htmlFor="a-name">Name</label><input id="a-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sampath Bank" maxLength={40} autoFocus /></div>
        <div><label className="label" htmlFor="a-open">Starting balance ({currencySymbol()})</label>
          <input id="a-open" className="input num" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^\d.,\-−]/g, ""))} placeholder="0" /></div>
      </div>
      <div>
        <span className="label">Type</span>
        <div className="chips" role="radiogroup" aria-label="Account type">
          {ACCOUNT_KINDS.map((k) => (
            <button type="button" key={k.id} role="radio" aria-checked={kind === k.id} className="chip-opt" onClick={() => setKind(k.id)}>
              <AccountIcon kind={k.id} color={color} size={14} />{k.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Colour</span>
        <div className="swatches" role="radiogroup" aria-label="Colour">
          {PALETTE.map((c) => <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} className="swatch" style={{ background: c }} onClick={() => setColor(c)} />)}
        </div>
      </div>
      <small style={{ color: "var(--muted)", fontSize: 12.5 }}>For a credit card or loan, enter what you owe as a negative number.</small>
      {err && <p className="form-error" style={{ margin: 0 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" type="submit">{initial ? "Save account" : "Add account"}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
        {extra}
      </div>
    </form>
  );
}

export default function Accounts() {
  const { settings, saveSettings, transactions } = useStore();
  const { openSheet, notify } = useUI();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const accounts = settings.accounts;
  const bal = useMemo(() => balances(accounts, transactions, settings.defaultAccountId), [accounts, transactions, settings.defaultAccountId]);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const total = accounts.reduce((s, a) => s + (bal.get(a.id) ?? 0), 0);
  const assets = accounts.reduce((s, a) => s + Math.max(bal.get(a.id) ?? 0, 0), 0);
  const debts = accounts.reduce((s, a) => s + Math.min(bal.get(a.id) ?? 0, 0), 0);
  const sel = accounts.find((a) => a.id === selected);
  const ids = accounts.map((a) => a.id);
  const selTx = sel ? transactions.filter((t) => accountOf(t, ids, settings.defaultAccountId) === sel.id || t.toAccountId === sel.id).sort(sortTx) : [];

  const upsert = async (a: Account) => {
    const exists = accounts.some((x) => x.id === a.id);
    await saveSettings({ accounts: exists ? accounts.map((x) => (x.id === a.id ? a : x)) : [...accounts, a] });
    notify(exists ? `${a.name} saved` : `${a.name} added`);
  };

  const Card = ({ a }: { a: Account }) => {
    const b = bal.get(a.id) ?? 0;
    return (
      <button className={`acct ${a.archived ? "archived" : ""}`} aria-pressed={selected === a.id}
        onClick={() => { setSelected(selected === a.id ? null : a.id); setEditing(false); setConfirmDel(false); }}>
        <span className="acct-top">
          <AccountIcon kind={a.kind} color={a.color} tile />
          <span style={{ minWidth: 0 }}><b>{a.name}</b><small>{ACCOUNT_KINDS.find((k) => k.id === a.kind)?.label}{settings.defaultAccountId === a.id ? " · Default" : ""}{a.archived ? " · Archived" : ""}</small></span>
        </span>
        <span className={`acct-bal ${b < 0 ? "neg" : ""}`}>{money(b)}</span>
      </button>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Accounts</h1><p>Where your money is: cash, bank, cards and wallets.</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {active.length > 1 && <button className="btn secondary" onClick={() => openSheet({ type: "transfer" })}><ArrowLeftRight />Transfer</button>}
          <button className="btn" onClick={() => { setAdding(true); setSelected(null); }}><Plus />Add account</button>
        </div>
      </div>

      <dl className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div className="stat"><dt>Net worth</dt><dd style={{ color: total < 0 ? "var(--neg)" : undefined }}>{money(total)}</dd><div className="hint">across {accounts.length} account{accounts.length === 1 ? "" : "s"}</div></div>
        <div className="stat"><dt>You have</dt><dd>{money(assets)}</dd></div>
        <div className="stat"><dt>You owe</dt><dd style={{ color: debts < 0 ? "var(--neg)" : undefined }}>{money(Math.abs(debts))}</dd></div>
      </dl>

      {adding && <AccountForm onCancel={() => setAdding(false)} onSave={async (a) => { setAdding(false); await upsert(a); setSelected(a.id); }} />}

      <div className="acct-grid">{active.map((a) => <Card key={a.id} a={a} />)}</div>

      {sel && (
        <section className="card">
          <div className="card-head">
            <h2>{sel.name}</h2>
            {!editing && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {settings.defaultAccountId !== sel.id && !sel.archived && (
                  <button className="btn secondary sm" onClick={async () => { await saveSettings({ defaultAccountId: sel.id }); notify(`${sel.name} is now the default account`); }}><Star />Make default</button>
                )}
                <button className="btn secondary sm" onClick={() => setEditing(true)}>Edit</button>
              </div>
            )}
          </div>
          {editing && (
            <AccountForm initial={sel} onCancel={() => setEditing(false)} onSave={async (a) => { setEditing(false); await upsert(a); }}
              extra={<>
                <span style={{ flex: 1 }} />
                <button type="button" className="btn ghost" onClick={async () => { setEditing(false); await upsert({ ...sel, archived: !sel.archived }); }}>
                  {sel.archived ? <><ArchiveRestore />Restore</> : <><Archive />Archive</>}
                </button>
                {confirmDel ? (
                  <button type="button" className="btn danger" onClick={async () => {
                    const rest = accounts.filter((x) => x.id !== sel.id);
                    await saveSettings({ accounts: rest, ...(settings.defaultAccountId === sel.id ? { defaultAccountId: rest[0]?.id } : {}) });
                    setSelected(null); notify(`${sel.name} deleted`);
                  }}>Confirm delete</button>
                ) : (
                  <button type="button" className="btn ghost" disabled={selTx.length > 0 || accounts.length < 2}
                    title={selTx.length ? "This account has transactions. Archive it instead." : undefined} onClick={() => setConfirmDel(true)}><Trash2 />Delete</button>
                )}
              </>}
            />
          )}
          {!editing && (selTx.length === 0 ? (
            <div className="empty"><Wallet /><b>No transactions yet</b>Entries you record against {sel.name} appear here.</div>
          ) : (
            <div style={{ margin: "0 -8px" }}>{selTx.slice(0, 15).map((t) => <TxRow key={t.id} t={t} showDate />)}</div>
          ))}
        </section>
      )}

      {archived.length > 0 && (
        <>
          <div className="sub-head">Archived</div>
          <div className="acct-grid">{archived.map((a) => <Card key={a.id} a={a} />)}</div>
        </>
      )}
    </div>
  );
}
