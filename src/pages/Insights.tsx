import { PieChart as PieIcon } from "lucide-react";
import { useStore } from "../data/store";
import { useUI } from "../data/ui";
import { inMonth, lastMonths, summarize } from "../lib/analytics";
import { getCategory } from "../lib/categories";
import { compact, money, monthLabel, shiftMonth, dayLabel } from "../lib/format";
import { CatTile, MonthSwitch } from "../components/bits";
import { CashflowChart, CategoryDonut } from "../components/charts";

export default function Insights() {
  const { transactions, settings } = useStore();
  const { month, openSheet } = useUI();
  const s = summarize(transactions, month);
  const pFull = summarize(transactions, shiftMonth(month, -1));
  // For the current month, compare against the same days of last month so partial months stay fair.
  const p = s.phase === "current"
    ? summarize(transactions.filter((t) => !t.date.startsWith(pFull.mk) || Number(t.date.slice(8, 10)) <= s.elapsed), pFull.mk)
    : pFull;
  const periodNote = s.phase === "current" ? ` (1–${s.elapsed})` : "";
  const months = lastMonths(month, 6).map((mk) => summarize(transactions, mk));
  const exp = inMonth(transactions, month).filter((t) => t.type === "expense");
  const biggest = [...exp].sort((a, b) => b.amount - a.amount)[0];
  const savingsRate = s.income > 0 ? (s.net / s.income) * 100 : null;
  const avgDaily = s.elapsed ? s.expense / s.elapsed : 0;
  const withData = months.filter((m) => m.expense > 0 || m.income > 0);
  const avgMonthly = withData.length ? withData.reduce((a, m) => a + m.expense, 0) / withData.length : 0;

  // Weekday pattern
  const byDow = Array(7).fill(0);
  exp.forEach((t) => { const [y, m, d] = t.date.split("-").map(Number); byDow[new Date(y, m - 1, d).getDay()] += t.amount; });
  const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const maxDow = Math.max(...byDow, 1);
  const order = settings.weekStart === 0 ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];

  // Change by category vs last month
  const ids = new Set([...s.byCategory.map((c) => c.id), ...p.byCategory.map((c) => c.id)]);
  const movers = [...ids].map((id) => {
    const now = s.byCategory.find((c) => c.id === id)?.total ?? 0;
    const then = p.byCategory.find((c) => c.id === id)?.total ?? 0;
    return { id, now, then, d: now - then };
  }).filter((m) => Math.abs(m.d) > 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Insights</h1><p>Where your money went in {monthLabel(month)}, and how it compares.</p></div>
        <MonthSwitch />
      </div>

      <dl className="stats">
        <div className="stat"><dt>Savings rate</dt><dd style={{ color: savingsRate == null ? undefined : savingsRate >= 0 ? "var(--pos)" : "var(--neg)" }}>{savingsRate == null ? "—" : `${Math.round(savingsRate)}%`}</dd><div className="hint">of income kept</div></div>
        <div className="stat"><dt>Average per day</dt><dd>{money(avgDaily)}</dd><div className="hint">over {s.elapsed} day{s.elapsed === 1 ? "" : "s"}</div></div>
        <div className="stat"><dt>vs last month</dt><dd>{p.expense ? `${s.expense >= p.expense ? "+" : "−"}${Math.round((Math.abs(s.expense - p.expense) / p.expense) * 100)}%` : "—"}</dd><div className="hint">{p.expense ? `${money(p.expense)} in ${monthLabel(p.mk, "short", false)}${periodNote}` : "no data"}</div></div>
        <div className="stat"><dt>Biggest expense</dt><dd>{biggest ? money(biggest.amount) : "—"}</dd><div className="hint" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{biggest ? `${biggest.note || getCategory(biggest.categoryId).name} · ${dayLabel(biggest.date)}` : "nothing yet"}</div></div>
      </dl>

      <div className="grid-2 even">
        <section className="card">
          <div className="card-head"><h2>Spending by category</h2><span className="meta">{s.byCategory.length} categories</span></div>
          {s.byCategory.length === 0 ? (
            <div className="empty"><PieIcon /><b>No spending in {monthLabel(month, "long", false)}</b><button className="btn sm" onClick={() => openSheet()}>Add an expense</button></div>
          ) : (
            <div className="donut-wrap">
              <CategoryDonut rows={s.byCategory} total={s.expense} />
              <div className="stack" style={{ gap: 10 }}>
                {s.byCategory.slice(0, 7).map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, minWidth: 0 }}>
                    <i style={{ width: 10, height: 10, borderRadius: 3, background: getCategory(c.id).color, flex: "none" }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getCategory(c.id).name}</span>
                    <span className="num" style={{ color: "var(--muted)" }}>{Math.round((c.total / s.expense) * 100)}%</span>
                    <span className="num" style={{ fontWeight: 600, minWidth: 84, textAlign: "right" }}>{money(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Income vs expenses</h2><span className="meta">Avg spend {money(avgMonthly)}/month</span></div>
          <CashflowChart rows={months} />
          <div className="chart-legend"><span><i style={{ background: "var(--pos)" }} />Income</span><span><i style={{ background: "var(--ink)" }} />Expenses</span></div>
        </section>
      </div>

      <div className="grid-2 even">
        <section className="card">
          <div className="card-head"><h2>Biggest changes</h2><span className="meta">vs {monthLabel(p.mk, "long", false)}{periodNote}</span></div>
          {movers.length === 0 ? <div className="empty">Not enough data to compare yet.</div> : (
            <div className="stack">
              {movers.map((m) => (
                <div className="cat-line" key={m.id}>
                  <CatTile id={m.id} size="sm" />
                  <span className="n">{getCategory(m.id).name}<small>{money(m.then)} → {money(m.now)}</small></span>
                  <span className={`chip ${m.d > 0 ? "neg" : "pos"}`}>{m.d > 0 ? "+" : "−"}{money(Math.abs(m.d))}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>By day of the week</h2><span className="meta">{monthLabel(month, "long", false)}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, alignItems: "end", height: 180 }} role="img"
            aria-label={`Highest spending day: ${dowNames[byDow.indexOf(Math.max(...byDow))]}`}>
            {order.map((d) => (
              <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }} title={`${dowNames[d]}: ${money(byDow[d])}`}>
                <span className="num" style={{ fontSize: 11, color: "var(--muted)" }}>{byDow[d] ? compact(byDow[d]) : ""}</span>
                <span style={{ width: "100%", maxWidth: 34, height: `${Math.max((byDow[d] / maxDow) * 130, 3)}px`, borderRadius: 8,
                  background: byDow[d] === maxDow && maxDow > 1 ? "var(--accent)" : "var(--surface-3)" }} />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{dowNames[d]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
