import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Wallet, Gauge, Plus, Receipt } from "lucide-react";
import { useStore } from "../data/store";
import { useUI } from "../data/ui";
import { cumulative, summarize } from "../lib/analytics";
import { daysInMonth, money, monthLabel, shiftMonth, thisMonth } from "../lib/format";
import { getCategory } from "../lib/categories";
import { CatTile, MonthSwitch } from "../components/bits";
import { TxRow, sortTx } from "../components/TxList";
import { TrendChart } from "../components/charts";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Overview() {
  const { transactions, settings, recurring, user } = useStore();
  const { month, openSheet } = useUI();
  const s = summarize(transactions, month);
  const prev = summarize(transactions, shiftMonth(month, -1));
  const budget = settings.monthlyBudget || 0;
  const reference = budget || s.income; // what we measure spending against
  const left = reference - s.expense;
  const daysLeft = s.phase === "current" ? s.days - s.elapsed + 1 : s.phase === "future" ? s.days : 0;
  const expected = reference * (s.elapsed / s.days);
  const diff = s.expense - expected;

  let k: "good" | "warn" | "bad" | "idle" = "good";
  let chip = "On track";
  let line = "";
  if (!reference) { k = "idle"; chip = "No budget yet"; line = "Set a monthly budget or add income to track your pace."; }
  else if (left < 0) { k = "bad"; chip = "Over budget"; line = `${money(-left)} over your ${budget ? "budget" : "income"}.`; }
  else if (s.phase === "past") { chip = "Month closed"; line = `You kept ${money(left)} of your ${budget ? "budget" : "income"}.`; }
  else if (s.phase === "future") { k = "idle"; chip = "Not started"; line = "This month hasn't started yet."; }
  else if (diff > reference * 0.05) { k = "warn"; chip = "Spending fast"; line = `${money(diff)} ahead of an even pace for day ${s.elapsed}.`; }
  else if (diff < -reference * 0.05) { chip = "Under pace"; line = `${money(-diff)} below an even pace for day ${s.elapsed}.`; }
  else { line = `Right on pace for day ${s.elapsed} of ${s.days}.`; }

  const pct = reference ? Math.min(s.expense / reference, 1) * 100 : 0;
  const recent = transactions.filter((t) => t.date.startsWith(month)).sort(sortTx).slice(0, 6);
  const curve = cumulative(transactions, month);
  const prevCurve = cumulative(transactions, shiftMonth(month, -1));

  const isNow = month === thisMonth();
  const today = new Date().getDate();
  const upcoming = isNow
    ? recurring.filter((r) => r.active && (r.lastPosted ?? "") < month && Math.min(r.dayOfMonth, daysInMonth(month)) > today)
        .sort((a, b) => a.dayOfMonth - b.dayOfMonth)
    : [];
  const alerts = Object.entries(settings.budgets)
    .map(([id, limit]) => ({ id, limit, spent: s.byCategory.find((c) => c.id === id)?.total ?? 0 }))
    .filter((b) => b.limit > 0 && b.spent / b.limit >= 0.8)
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

  const firstName = (settings.displayName || user?.name || "").split(" ")[0];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{isNow ? `${greeting()}${firstName ? `, ${firstName}` : ""}` : monthLabel(month)}</h1>
          <p>{isNow ? `Here's ${monthLabel(month, "long", false)} so far.` : "Month in review."}</p>
        </div>
        <MonthSwitch />
      </div>

      <section className="hero" aria-label="Month summary">
        <div className="hero-left">
          <div className="eyebrow">Spent in {monthLabel(month, "long", false)}</div>
          <div className="big"><span className="cur">Rs</span>{Math.round(s.expense).toLocaleString("en-US")}</div>
          <div className="sub"><span className="pace" data-k={k}><i />{chip}</span><span>{line}</span></div>
          {reference > 0 && (
            <div className="meter">
              <div className="meter-track" role="img" aria-label={`${Math.round((s.expense / reference) * 100)}% of ${budget ? "budget" : "income"} used`}>
                <div className="meter-fill" data-k={k === "idle" ? "good" : k} style={{ width: `${pct}%` }} />
                {s.phase === "current" && <div className="meter-mark" style={{ left: `${(s.elapsed / s.days) * 100}%` }} title="Even pace for today" />}
              </div>
              <div className="meter-legend">
                <span>{Math.round((s.expense / reference) * 100)}% of {budget ? `${money(budget)} budget` : "income"}</span>
                {s.phase === "current" && <span>Line = today’s even pace</span>}
              </div>
            </div>
          )}
        </div>
        <dl className="hero-side">
          <div className="hero-stat"><dt><ArrowDownLeft />Income</dt><dd>{money(s.income)}</dd></div>
          <div className="hero-stat"><dt><ArrowUpRight />Net</dt><dd>{money(s.net, { sign: true })}</dd></div>
          <div className="hero-stat"><dt><Wallet />{left >= 0 ? "Left to spend" : "Over by"}</dt><dd>{money(Math.abs(left))}</dd></div>
          <div className="hero-stat">
            <dt><Gauge />{s.phase === "current" ? "Per day" : "Daily average"}</dt>
            <dd>{s.phase === "current" ? money(Math.max(left, 0) / daysLeft) : money(s.elapsed ? s.expense / s.elapsed : 0)}</dd>
            {s.phase === "current" && <div className="hint">for {daysLeft} day{daysLeft === 1 ? "" : "s"} left</div>}
          </div>
        </dl>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Spending this month</h2>
            <span className="meta">{prev.expense > 0 && s.phase !== "future" ? compareText(curve[s.elapsed], prevCurve[Math.min(s.elapsed, prevCurve.length - 1)]) : ""}</span>
          </div>
          <TrendChart current={curve} previous={prevCurve} elapsed={s.elapsed} budget={budget || undefined} mk={month} />
          <div className="chart-legend">
            <span><i className="line" style={{ borderColor: "var(--accent)" }} />{monthLabel(month, "long", false)}</span>
            <span><i className="dash" style={{ borderColor: "var(--faint)" }} />{monthLabel(shiftMonth(month, -1), "long", false)}</span>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Top categories</h2><Link className="more" to="/insights">See all</Link></div>
          {s.byCategory.length === 0 ? (
            <div className="empty"><Receipt /><b>No spending yet</b>Your top categories will show up here.</div>
          ) : (
            <div className="stack">
              {s.byCategory.slice(0, 5).map((c) => {
                const cat = getCategory(c.id);
                const limit = settings.budgets[c.id];
                return (
                  <div className="cat-line" key={c.id}>
                    <CatTile id={c.id} size="sm" />
                    <span className="n">{cat.name}<small>{c.count} transaction{c.count === 1 ? "" : "s"}</small></span>
                    <span className="v">{money(c.total)}<small>{limit ? `of ${money(limit)}` : `${Math.round((c.total / s.expense) * 100)}%`}</small></span>
                    <span className="bar" style={{ gridColumn: "2 / -1" }}>
                      <i style={{ width: `${Math.min((c.total / (limit || s.byCategory[0].total)) * 100, 100)}%`, background: limit && c.total > limit ? "var(--neg)" : cat.color }} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Recent transactions</h2><Link className="more" to="/transactions">View all</Link></div>
          {recent.length === 0 ? (
            <div className="empty">
              <Receipt /><b>Nothing recorded in {monthLabel(month, "long", false)}</b>
              <span>Add your first expense or income to get started.</span>
              <button className="btn sm" onClick={() => openSheet()} style={{ marginTop: 6 }}><Plus />Add transaction</button>
            </div>
          ) : (
            <div style={{ margin: "0 -8px" }}>{recent.map((t) => <TxRow key={t.id} t={t} showDate />)}</div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Coming up</h2><Link className="more" to="/settings#recurring">Manage</Link></div>
          {upcoming.length === 0 && alerts.length === 0 ? (
            <div className="empty"><CalendarClock /><b>All clear</b>No bills due later this month and every budget has room.</div>
          ) : (
            <div className="stack">
              {upcoming.map((r) => (
                <div className="cat-line" key={r.id}>
                  <CatTile id={r.categoryId} size="sm" />
                  <span className="n">{r.note}<small>Due {monthLabel(month, "short", false)} {r.dayOfMonth} · in {r.dayOfMonth - today} day{r.dayOfMonth - today === 1 ? "" : "s"}</small></span>
                  <span className={`v ${r.type === "income" ? "amt in" : ""}`}>{r.type === "income" ? "+" : ""}{money(r.amount)}</span>
                </div>
              ))}
              {alerts.map((a) => (
                <div className="cat-line" key={a.id}>
                  <CatTile id={a.id} size="sm" />
                  <span className="n">{getCategory(a.id).name}<small>{money(a.spent)} of {money(a.limit)} budget</small></span>
                  <span className={`chip ${a.spent > a.limit ? "neg" : "warn"}`}>{a.spent > a.limit ? `${money(a.spent - a.limit)} over` : `${Math.round((a.spent / a.limit) * 100)}% used`}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function compareText(now: number, then: number) {
  if (!then) return "";
  const d = now - then;
  const pct = Math.round((Math.abs(d) / then) * 100);
  if (pct < 3) return "Same as last month so far";
  return `${pct}% ${d > 0 ? "more" : "less"} than last month so far`;
}
