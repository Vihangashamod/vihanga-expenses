import { Repeat } from "lucide-react";
import type { Transaction } from "../lib/types";
import { getCategory } from "../lib/categories";
import { dayLabel, money } from "../lib/format";
import { CatTile } from "./bits";
import { useUI } from "../data/ui";

export function sortTx(a: Transaction, b: Transaction) {
  return b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);
}

export function TxRow({ t, showDate }: { t: Transaction; showDate?: boolean }) {
  const { openSheet } = useUI();
  const c = getCategory(t.categoryId);
  return (
    <button className="tx-row" onClick={() => openSheet({ tx: t })} aria-label={`Edit ${t.note || c.name}, ${money(t.amount)}`}>
      <CatTile id={t.categoryId} />
      <span className="t">
        <b>{t.note || c.name}</b>
        <small>
          {t.recurringId && <Repeat aria-label="Recurring" />}
          {c.name}{showDate ? ` · ${dayLabel(t.date)}` : ""}
        </small>
      </span>
      <span className={`amt ${t.type === "income" ? "in" : ""}`}>
        {t.type === "income" ? "+" : "−"}{money(t.amount, { exact: true })}
      </span>
    </button>
  );
}

export function TxGroups({ items }: { items: Transaction[] }) {
  const groups = new Map<string, Transaction[]>();
  [...items].sort(sortTx).forEach((t) => {
    const g = groups.get(t.date) ?? [];
    g.push(t);
    groups.set(t.date, g);
  });
  return (
    <div>
      {[...groups.entries()].map(([date, list]) => {
        const net = list.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
        return (
          <section className="tx-group" key={date}>
            <div className="tx-day"><span>{dayLabel(date)}</span><span className="num">{money(net, { sign: true })}</span></div>
            {list.map((t) => <TxRow key={t.id} t={t} />)}
          </section>
        );
      })}
    </div>
  );
}
