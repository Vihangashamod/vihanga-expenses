import { Repeat, Globe, CreditCard } from "lucide-react";
import type { Transaction } from "../lib/types";
import { getCategory } from "../lib/categories";
import { dayLabel, money } from "../lib/format";
import { CatTile } from "./bits";
import { useUI } from "../data/ui";
import { useStore } from "../data/store";

export function sortTx(a: Transaction, b: Transaction) {
  return b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);
}

export function TxRow({ t, showDate }: { t: Transaction; showDate?: boolean }) {
  const { openSheet } = useUI();
  const { settings } = useStore();
  const c = getCategory(t.categoryId);
  const accName = (id?: string) => settings.accounts.find((a) => a.id === id)?.name;
  const multi = settings.accounts.length > 1;
  const isXfer = t.type === "transfer";
  const acc = settings.accounts.find((a) => a.id === (t.accountId ?? settings.defaultAccountId));
  const onCard = !isXfer && t.type === "expense" && acc?.kind === "card";
  const title = t.note || (isXfer ? "Transfer" : c.name);
  const bits = [
    isXfer ? `${accName(t.accountId) ?? "?"} → ${accName(t.toAccountId) ?? "?"}` : c.name,
    !isXfer && multi && accName(t.accountId ?? settings.defaultAccountId),
    showDate && dayLabel(t.date),
  ].filter(Boolean);

  return (
    <button className="tx-row" onClick={() => openSheet({ tx: t })} aria-label={`Edit ${title}, ${money(t.amount)}`}>
      <CatTile id={isXfer ? "transfer" : t.categoryId} />
      <span className="t">
        <b>{title}</b>
        <small>
          {t.recurringId && <Repeat aria-label="Recurring" />}
          {t.originalCurrency && <Globe aria-label="Foreign currency" />}
          {onCard && <CreditCard aria-label="Paid by credit card" style={{ color: acc?.color }} />}
          {bits.join(" · ")}
        </small>
      </span>
      <span className={`amt ${t.type === "income" ? "in" : isXfer ? "xfer" : ""}`}>
        {t.type === "income" ? "+" : isXfer ? "" : "−"}{money(t.amount, { exact: true })}
        {t.originalCurrency && t.originalAmount != null && (
          <span className="fx-note">{money(t.originalAmount, { currency: t.originalCurrency, exact: true })}</span>
        )}
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
        const net = list.reduce((s, t) => s + (t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0), 0);
        return (
          <section className="tx-group" key={date}>
            <div className="tx-day"><span>{dayLabel(date)}</span><span className="num">{net ? money(net, { sign: true }) : ""}</span></div>
            {list.map((t) => <TxRow key={t.id} t={t} />)}
          </section>
        );
      })}
    </div>
  );
}
