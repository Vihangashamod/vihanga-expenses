import { useState } from "react";
import { Pencil, Check, X, Target } from "lucide-react";
import { useStore } from "../data/store";
import { useUI } from "../data/ui";
import { summarize, inMonth, sum } from "../lib/analytics";
import { allOf, getCategory, isHidden } from "../lib/categories";
import { periodOf, rangeLabel } from "../lib/period";
import { currencySymbol, money, monthLabel, parseAmount, shiftMonth } from "../lib/format";
import { CatTile, MonthSwitch } from "../components/bits";

function stateOf(spent: number, limit: number, expectedShare: number) {
  if (spent > limit) return { cls: "neg", color: "var(--neg)", text: `${money(spent - limit)} over` };
  if (spent / limit > Math.max(expectedShare + 0.1, 0.85)) return { cls: "warn", color: "var(--warn)", text: `${money(limit - spent)} left` };
  return { cls: "pos", color: "var(--pos)", text: `${money(limit - spent)} left` };
}

function AmountEditor({ value, onSave, onCancel, label }: { value?: number; onSave: (n: number) => void; onCancel: () => void; label: string }) {
  const [v, setV] = useState(value ? String(value) : "");
  return (
    <form className="budget-edit" onSubmit={(e) => { e.preventDefault(); const n = parseAmount(v); if (n >= 0) onSave(n); }}>
      <input className="input" autoFocus inputMode="decimal" aria-label={label} placeholder={currencySymbol()} value={v}
        onChange={(e) => setV(e.target.value.replace(/[^\d.,]/g, ""))} onKeyDown={(e) => e.key === "Escape" && onCancel()} />
      <button className="icon-btn" type="submit" aria-label="Save"><Check /></button>
      <button className="icon-btn plain" type="button" onClick={onCancel} aria-label="Cancel"><X /></button>
    </form>
  );
}

export default function Budgets() {
  const { transactions, settings, saveSettings } = useStore();
  const { month, notify } = useUI();
  const [editing, setEditing] = useState<string | null>(null);
  const s = summarize(transactions, month);
  const expectedShare = s.phase === "current" ? s.elapsed / s.days : 1;
  const spentBy = (id: string) => s.byCategory.find((c) => c.id === id)?.total ?? 0;
  const avg3 = (id: string) => {
    const totals = [1, 2, 3].map((n) => sum(inMonth(transactions, shiftMonth(month, -n)).filter((t) => t.type === "expense" && t.categoryId === id)));
    return totals.reduce((a, b) => a + b, 0) / 3;
  };

  const budgets = settings.budgets;
  const EXPENSE_CATEGORIES = allOf("expense").filter((c) => !isHidden(c.id) || budgets[c.id] > 0);
  const withBudget = EXPENSE_CATEGORIES.filter((c) => budgets[c.id] > 0)
    .sort((a, b) => spentBy(b.id) / budgets[b.id] - spentBy(a.id) / budgets[a.id]);
  const without = EXPENSE_CATEGORIES.filter((c) => !(budgets[c.id] > 0))
    .map((c) => ({ c, spent: spentBy(c.id), avg: avg3(c.id) }))
    .sort((a, b) => b.spent - a.spent || b.avg - a.avg);

  const totalLimits = withBudget.reduce((a, c) => a + budgets[c.id], 0);
  const total = settings.monthlyBudget || 0;

  const setCat = async (id: string, n: number) => {
    const next = { ...budgets };
    if (n > 0) next[id] = n; else delete next[id];
    setEditing(null);
    await saveSettings({ budgets: next });
    notify(n > 0 ? `${getCategory(id).name} budget set to ${money(n)}` : `${getCategory(id).name} budget removed`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Budgets</h1><p>Monthly limits in {settings.currency}, checked against what you've spent in {monthLabel(month)}{periodOf(month).custom ? ` (${rangeLabel(periodOf(month))})` : ""}.</p></div>
        <MonthSwitch />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Monthly budget</h2>
          {editing !== "__total" && <button className="btn secondary sm" onClick={() => setEditing("__total")}><Pencil />{total ? "Change" : "Set budget"}</button>}
        </div>
        {editing === "__total" ? (
          <AmountEditor label="Monthly budget" value={total} onCancel={() => setEditing(null)}
            onSave={async (n) => { setEditing(null); await saveSettings({ monthlyBudget: n }); notify(n ? `Monthly budget set to ${money(n)}` : "Monthly budget removed"); }} />
        ) : total ? (
          <div className="budget-row" style={{ padding: 0, border: 0 }}>
            <span className="cat-tile" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Target /></span>
            <span className="n"><b>{money(s.expense)} of {money(total)}</b><small>{Math.round((s.expense / total) * 100)}% used{s.phase === "current" ? ` · ${Math.round(expectedShare * 100)}% of the month gone` : ""}</small></span>
            <span className={`chip ${stateOf(s.expense, total, expectedShare).cls}`}>{stateOf(s.expense, total, expectedShare).text}</span>
            <span className="bar"><i style={{ width: `${Math.min((s.expense / total) * 100, 100)}%`, background: stateOf(s.expense, total, expectedShare).color }} /></span>
          </div>
        ) : (
          <p style={{ margin: 0, color: "var(--muted)" }}>Set one overall limit for everything you spend in a month. Without it, the overview measures spending against your income.</p>
        )}
        {total > 0 && totalLimits > total && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--warn)" }}>Your category budgets add up to {money(totalLimits)}, which is more than the monthly budget.</p>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2>Category budgets</h2><span className="meta">{withBudget.length ? `${withBudget.length} set · ${money(totalLimits)} total` : ""}</span></div>
        {withBudget.length === 0 && <p style={{ margin: "0 0 4px", color: "var(--muted)" }}>Pick a category below to give it a monthly limit.</p>}
        <div>
          {withBudget.map((c) => {
            const spent = spentBy(c.id), limit = budgets[c.id], st = stateOf(spent, limit, expectedShare);
            return (
              <div className="budget-row" key={c.id}>
                <CatTile id={c.id} />
                <span className="n"><b>{c.name}</b><small>{money(spent)} of {money(limit)}</small></span>
                {editing === c.id ? (
                  <AmountEditor label={`${c.name} budget`} value={limit} onCancel={() => setEditing(null)} onSave={(n) => setCat(c.id, n)} />
                ) : (
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className={`chip ${st.cls}`}>{st.text}</span>
                    <button className="icon-btn plain" onClick={() => setEditing(c.id)} aria-label={`Edit ${c.name} budget`}><Pencil /></button>
                  </span>
                )}
                <span className="bar"><i style={{ width: `${Math.min((spent / limit) * 100, 100)}%`, background: st.color }} /></span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Add a budget</h2><span className="meta">Sorted by what you spend most</span></div>
        <div>
          {without.map(({ c, spent, avg }) => (
            <div className="budget-row" key={c.id}>
              <CatTile id={c.id} size="sm" />
              <span className="n"><b>{c.name}</b><small>{spent ? `${money(spent)} this month` : "Nothing this month"}{avg > 0 ? ` · ${money(Math.round(avg))} a month on average` : ""}</small></span>
              {editing === c.id ? (
                <AmountEditor label={`${c.name} budget`} value={avg > 0 ? Math.ceil(avg / 500) * 500 : undefined} onCancel={() => setEditing(null)} onSave={(n) => setCat(c.id, n)} />
              ) : (
                <button className="btn secondary sm" onClick={() => setEditing(c.id)}>Set limit</button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
