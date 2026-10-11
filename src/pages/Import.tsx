import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareText, Check, Smartphone, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { useStore } from "../data/store";
import { useUI } from "../data/ui";
import { parseAlerts, merchantKey, type ParsedAlert } from "../lib/sms";
import { getCategory, pickable } from "../lib/categories";
import { money, parseAmount, shortDate } from "../lib/format";
import { rateToBase } from "../lib/currency";
import type { Transaction } from "../lib/types";
import { CatTile } from "../components/bits";

interface Row extends ParsedAlert {
  include: boolean;
  duplicate: boolean;
  note: string;
  type: Transaction["type"];
  toAccountId?: string;
  /** Base units per 1 unit of the alert's currency, for foreign-currency alerts */
  rate?: string;
}

export default function Import() {
  const { transactions, settings, saveMany, saveSettings } = useStore();
  const { notify } = useUI();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const accounts = settings.accounts.filter((a) => !a.archived);
  const cash = accounts.find((a) => a.kind === "cash");
  const ids = useMemo(() => new Set(transactions.map((t) => t.id)), [transactions]);

  const read = (src: string) => {
    const res = parseAlerts(src, settings.accounts, settings.merchantRules);
    setSkipped(res.skipped);
    setDone(null);
    setRows(res.alerts.map((a) => {
      // Same alert already imported, or an entry you typed by hand with the same date and amount.
      const duplicate = ids.has(a.key) || transactions.some((t) => t.date === a.date && Math.abs(t.amount - a.amount) < 0.005 && t.type !== "income" === (a.direction === "debit"));
      const isAtm = a.kind === "withdrawal" && a.direction === "debit" && !!cash && a.accountId !== cash.id;
      return {
        ...a, include: !duplicate, duplicate,
        note: a.merchant,
        type: isAtm ? "transfer" : a.direction === "credit" ? "income" : "expense",
        toAccountId: isAtm ? cash!.id : undefined,
        accountId: a.accountId ?? (accounts.find((x) => x.kind === "bank")?.id ?? settings.defaultAccountId),
      };
    }));
    // Look up today's rate for alerts in another currency (e.g. USD card payments).
    const foreign = [...new Set(res.alerts.map((a) => a.currency).filter((c) => c !== settings.currency))];
    foreign.forEach((cur) => {
      rateToBase(cur, settings.currency).then((r) => {
        if (!r) return;
        setRows((rs) => rs?.map((x) => (x.currency === cur && !x.rate ? { ...x, rate: String(+r.toFixed(4)) } : x)) ?? null);
      });
    });
  };

  // Alerts sent from the iPhone Shortcut arrive in the address after "#sms=" (never sent to a server).
  useEffect(() => {
    const m = location.hash.match(/^#sms=(.*)$/s);
    if (m) {
      let msg = "";
      try { msg = decodeURIComponent(m[1]); } catch { msg = m[1]; }
      history.replaceState(null, "", location.pathname);
      setText(msg);
      read(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  // Digits seen in alerts that aren't linked to any account yet.
  // Digits like "76" and "6576" are the same account shown differently, so keep only the longest form.
  const unknownDigits = (rows ?? [])
    .filter((r) => r.digits && !settings.accounts.some((a) => a.smsDigits && (a.smsDigits.endsWith(r.digits!) || r.digits!.endsWith(a.smsDigits))))
    .map((r) => r.digits!)
    .sort((a, b) => b.length - a.length)
    .reduce<string[]>((acc, d) => (acc.some((x) => x.endsWith(d) || d.endsWith(x.slice(-d.length))) ? acc : [...acc, d]), []);

  const linkDigits = async (digits: string, accountId: string) => {
    await saveSettings({ accounts: settings.accounts.map((a) => (a.id === accountId ? { ...a, smsDigits: digits.slice(-4) } : a)) });
    setRows((rs) => rs?.map((r) => (r.digits && (digits.endsWith(r.digits) || r.digits.endsWith(digits.slice(-Math.min(4, r.digits.length)))) ? { ...r, accountId } : r)) ?? null);
    notify(`Alerts for …${digits.slice(-4)} will go to ${settings.accounts.find((a) => a.id === accountId)?.name}`);
  };

  const isForeign = (r: Row) => r.currency !== settings.currency;
  const rateOf = (r: Row) => (isForeign(r) ? parseAmount(r.rate ?? "") : 1);
  const baseAmount = (r: Row) => Math.round(r.amount * rateOf(r) * 100) / 100;
  const chosen = (rows ?? []).filter((r) => r.include);
  const missingRate = chosen.some((r) => isForeign(r) && !(rateOf(r) > 0));
  const add = async () => {
    if (!chosen.length) return;
    setBusy(true);
    const txs: Transaction[] = chosen.map((r, i) => ({
      id: r.key, type: r.type, amount: baseAmount(r),
      ...(isForeign(r) ? { originalCurrency: r.currency, originalAmount: r.amount, rate: rateOf(r) } : {}), note: r.note.trim() || r.merchant, date: r.date,
      categoryId: r.type === "transfer" ? "transfer" : r.categoryId,
      createdAt: Date.now() + i, source: "sms",
      ...(r.accountId ? { accountId: r.accountId } : {}),
      ...(r.type === "transfer" && r.toAccountId ? { toAccountId: r.toAccountId } : {}),
    }));
    // Remember the category you chose for each place, so next time it's picked automatically.
    const learned = { ...settings.merchantRules };
    chosen.forEach((r) => { if (r.type !== "transfer") { const k = merchantKey(r.merchant); if (k) learned[k] = r.categoryId; } });
    await Promise.all([saveMany(txs), saveSettings({ merchantRules: learned })]);
    setBusy(false);
    setDone(txs.length);
    setRows(null);
    setText("");
    notify(`Added ${txs.length} transaction${txs.length === 1 ? "" : "s"} from SMS`);
  };

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div><h1>Import from SMS</h1><p>Paste bank alerts and add them as transactions in one go.</p></div>
      </div>

      {done != null && (
        <div className="banner"><span><b>Added {done} transaction{done === 1 ? "" : "s"}.</b> They're in your list with an SMS tag.</span><Link className="btn sm" to="/transactions">View transactions</Link></div>
      )}

      <section className="card">
        <label className="label" htmlFor="sms-text">Bank alerts</label>
        <textarea id="sms-text" ref={area} className="input sms-area" value={text} spellCheck={false}
          placeholder={"Paste one or more alerts, e.g.\nHNB SMS ALERT: PURCHASE, Debit account:2010***6576,Location:Keells - Nugegoda, LK,Amount(Approx.):3900.00 LKR,…"}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t) { e.preventDefault(); const next = text ? `${text}\n${t}` : t; setText(next); read(next); } }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={() => read(text)} disabled={!text.trim()}><MessageSquareText />Read alerts</button>
          {text && <button className="btn ghost" onClick={() => { setText(""); setRows(null); setSkipped([]); area.current?.focus(); }}>Clear</button>}
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Works with HNB alerts and most other bank formats. One-time codes are ignored.</span>
        </div>
      </section>

      {unknownDigits.length > 0 && accounts.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Which account is this?</h2></div>
          {unknownDigits.map((d) => (
            <div className="set-row" key={d} style={{ borderBottom: 0, padding: "6px 0" }}>
              <span className="t"><b>Account ending …{d.slice(-4)}</b><small>Link it once and future alerts go there automatically.</small></span>
              <select className="select" style={{ width: 220 }} defaultValue="" aria-label={`Account ending ${d.slice(-4)}`} onChange={(e) => e.target.value && void linkDigits(d, e.target.value)}>
                <option value="" disabled>Choose account…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          ))}
        </section>
      )}

      {rows && (
        <section className="card">
          <div className="card-head">
            <h2>{rows.length ? `Found ${rows.length} transaction${rows.length === 1 ? "" : "s"}` : "No transactions found"}</h2>
            {rows.length > 0 && <span className="meta">{chosen.length} selected · {money(chosen.filter((r) => r.type === "expense").reduce((a, r) => a + (baseAmount(r) || 0), 0))} spent</span>}
          </div>
          {rows.length === 0 && <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>Nothing in the pasted text looked like a bank alert with an amount and a date.</p>}
          <div className="import-list">
            {rows.map((r) => {
              const cats = r.type === "transfer" ? [] : pickable(r.type === "income" ? "income" : "expense");
              return (
                <div className={`import-row ${r.include ? "" : "off"}`} key={r.key}>
                  <button className="check" role="checkbox" aria-checked={r.include} aria-label={r.include ? "Leave out" : "Include"} onClick={() => update(r.key, { include: !r.include })}>{r.include && <Check />}</button>
                  <CatTile id={r.type === "transfer" ? "transfer" : r.categoryId} />
                  <div className="import-main">
                    <input className="input" value={r.note} onChange={(e) => update(r.key, { note: e.target.value })} aria-label="Note" />
                    <div className="import-meta">
                      <span>{shortDate(r.date)}{r.time ? `, ${r.time}` : ""}</span>
                      {r.type === "transfer" ? (
                        <span>{settings.accounts.find((a) => a.id === r.accountId)?.name} → {settings.accounts.find((a) => a.id === r.toAccountId)?.name}</span>
                      ) : (
                        <select className="mini-select" value={r.categoryId} onChange={(e) => update(r.key, { categoryId: e.target.value })} aria-label="Category">
                          {(cats.some((c) => c.id === r.categoryId) ? cats : [getCategory(r.categoryId), ...cats]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                      <select className="mini-select" value={r.accountId ?? ""} onChange={(e) => update(r.key, { accountId: e.target.value })} aria-label="Account">
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      {r.duplicate && <span className="chip warn"><AlertCircle size={12} />Looks already added</span>}
                    </div>
                  </div>
                  <span className={`amt ${r.type === "income" ? "in" : r.type === "transfer" ? "xfer" : ""}`}>
                    {r.type === "income" ? "+" : r.type === "transfer" ? "" : "−"}{money(r.amount, { exact: true, currency: r.currency })}
                    {isForeign(r) && (
                      <span className="fx-note">
                        {rateOf(r) > 0 ? `≈ ${money(baseAmount(r), { exact: true })}` : "Needs a rate"}
                        <label className="fx-inline">1 {r.currency} = <input inputMode="decimal" value={r.rate ?? ""} placeholder="rate"
                          onChange={(e) => update(r.key, { rate: e.target.value.replace(/[^\d.,]/g, "") })} aria-label={`${settings.currency} per 1 ${r.currency}`} /> {settings.currency}</label>
                      </span>
                    )}
                    {r.balance != null && !isForeign(r) && <span className="fx-note">Bal {money(r.balance, { exact: true })}</span>}
                  </span>
                </div>
              );
            })}
          </div>
          {skipped.length > 0 && <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted)" }}>Skipped {skipped.length}: {skipped.join(" · ")}</p>}
          {rows.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {missingRate && <span style={{ fontSize: 13, color: "var(--warn)", alignSelf: "center" }}>Type the exchange rate for the foreign-currency rows first.</span>}
              <button className="btn" disabled={!chosen.length || busy || missingRate} onClick={add}><Check />Add {chosen.length} transaction{chosen.length === 1 ? "" : "s"}</button>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <button className="how-toggle" onClick={() => setShowHow((v) => !v)} aria-expanded={showHow}>
          <Smartphone /><span><b>Send alerts here automatically from your iPhone</b><small>Set up once with the Shortcuts app. Each new HNB alert opens this page ready to add.</small></span>
          {showHow ? <ChevronUp /> : <ChevronDown />}
        </button>
        {showHow && (
          <ol className="how">
            <li>Open the <b>Shortcuts</b> app → <b>Automation</b> tab → <b>+</b> → <b>Message</b>.</li>
            <li>Set <b>Message Contains</b> to <code>HNB SMS ALERT</code>. Choose <b>Run Immediately</b>, then <b>Next</b> → <b>New Blank Automation</b>.</li>
            <li>Add the action <b>URL Encode</b>. Set its input to <b>Shortcut Input → Message</b> (tap the input and pick <i>Message</i>).</li>
            <li>Add <b>Text</b> with <code>https://vihanga-expenses.web.app/import#sms=</code> and then the <b>URL Encoded Text</b> variable straight after it, with no space.</li>
            <li>Add <b>Open URLs</b> with that Text. Tap <b>Done</b>.</li>
            <li>Repeat steps 1–5 with <code>A Transaction for</code> so account debits like SMS charges come in too.</li>
          </ol>
        )}
        {showHow && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>The alert travels after the “#” in the link, which stays on your phone and is never sent to any server. You still confirm each import here.</p>}
      </section>
    </div>
  );
}
