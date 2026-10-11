import { useMemo, useState } from "react";
import { Search, Receipt, Plus, Download } from "lucide-react";
import { useStore } from "../data/store";
import { useUI } from "../data/ui";
import { CATEGORIES, getCategory } from "../lib/categories";
import { money, monthLabel } from "../lib/format";
import { MonthSwitch } from "../components/bits";
import { TxGroups, sortTx } from "../components/TxList";
import type { Transaction } from "../lib/types";

type Kind = "all" | "expense" | "income";

export function toCSV(items: Transaction[]) {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return ["Date,Type,Category,Note,Amount (LKR)"]
    .concat([...items].sort(sortTx).reverse().map((t) => [t.date, t.type, q(getCategory(t.categoryId).name), q(t.note), t.type === "income" ? t.amount : -t.amount].join(",")))
    .join("\n");
}

export function downloadCSV(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Transactions() {
  const { transactions } = useStore();
  const { month, openSheet } = useUI();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [cat, setCat] = useState("all");
  const [allTime, setAllTime] = useState(false);

  const scope = useMemo(() => (allTime ? transactions : transactions.filter((t) => t.date.startsWith(month))), [transactions, month, allTime]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scope.filter((t) =>
      (kind === "all" || t.type === kind) &&
      (cat === "all" || t.categoryId === cat) &&
      (!needle || t.note.toLowerCase().includes(needle) || getCategory(t.categoryId).name.toLowerCase().includes(needle) || String(t.amount).includes(needle)));
  }, [scope, q, kind, cat]);

  const income = shown.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = shown.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const usedCats = CATEGORIES.filter((c) => scope.some((t) => t.categoryId === c.id));
  const filtered = q || kind !== "all" || cat !== "all";

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Transactions</h1><p>{allTime ? "Everything you've recorded." : `Everything in ${monthLabel(month)}.`}</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!allTime && <MonthSwitch />}
          <div className="seg" role="group" aria-label="Range">
            <button aria-pressed={!allTime} onClick={() => setAllTime(false)}>Month</button>
            <button aria-pressed={allTime} onClick={() => setAllTime(true)}>All time</button>
          </div>
        </div>
      </div>

      <dl className="stats">
        <div className="stat"><dt>Income</dt><dd style={{ color: "var(--pos)" }}>{money(income)}</dd></div>
        <div className="stat"><dt>Expenses</dt><dd>{money(expense)}</dd></div>
        <div className="stat"><dt>Net</dt><dd>{money(income - expense, { sign: true })}</dd></div>
        <div className="stat"><dt>Transactions</dt><dd>{shown.length}</dd></div>
      </dl>

      <section className="card">
        <div className="toolbar" style={{ marginBottom: 16 }}>
          <label className="search">
            <Search />
            <span className="sr">Search transactions</span>
            <input id="tx-search" className="input" type="search" placeholder="Search notes, categories or amounts" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="seg" role="group" aria-label="Type">
            {(["all", "expense", "income"] as Kind[]).map((k) => (
              <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === "all" ? "All" : k === "expense" ? "Expenses" : "Income"}</button>
            ))}
          </div>
          <label className="sr" htmlFor="tx-cat">Category</label>
          <select id="tx-cat" className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories</option>
            {usedCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn secondary" onClick={() => downloadCSV(`expenses-${allTime ? "all" : month}.csv`, toCSV(shown))} disabled={!shown.length}>
            <Download />CSV
          </button>
        </div>

        {shown.length === 0 ? (
          <div className="empty">
            <Receipt />
            {filtered ? <><b>No matches</b>Try a different search or clear the filters.</>
              : <><b>No transactions yet</b>Add an expense or income for {monthLabel(month, "long", false)}.
                <button className="btn sm" onClick={() => openSheet()} style={{ marginTop: 6 }}><Plus />Add transaction</button></>}
          </div>
        ) : (
          <div style={{ margin: "0 -8px" }}><TxGroups items={shown} /></div>
        )}
      </section>
    </div>
  );
}
