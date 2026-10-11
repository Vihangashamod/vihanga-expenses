import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Wallet, Gauge, Plus, Receipt, PiggyBank, Repeat2, CreditCard } from "lucide-react";
import { cardStatus } from "../lib/cards";
import { useStore } from "../data/store";
import { useUI } from "../data/ui";
import { balances, cumulative, inMonth, leftover, summarize } from "../lib/analytics";
import { AccountIcon } from "../components/AccountIcon";
import { currencySymbol, dayLabel, isPrivate, money, monthKey, monthLabel, shiftMonth, shortDate, todayISO } from "../lib/format";
import { currentPeriodKey, daysBetween, rangeLabel } from "../lib/period";
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
  const lo = leftover(transactions, month, settings.monthlyBudget, settings.leftover);
  const carried = settings.leftover === "carry" ? Math.round(lo.carriedIn) : 0;
  const prevName = monthLabel(shiftMonth(month, -1), "long", false);
  // What spending is measured against: budget (or income) plus anything carried over.
  const reference = (budget || s.income) + carried;
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
  const recent = inMonth(transactions, month).sort(sortTx).slice(0, 6);
  const curve = cumulative(transactions, month);
  const prevCurve = cumulative(transactions, shiftMonth(month, -1));

  const isNow = month === currentPeriodKey();
  const todayIso = todayISO();
  // Next date each recurring item posts, if it falls later in this period.
  const upcoming = isNow
    ? recurring.filter((r) => r.active).map((r) => {
        const cm = monthKey(new Date());
        for (const cand of [cm, shiftMonth(cm, 1)]) {
          const [y, m] = cand.split("-").map(Number);
          const day = Math.min(r.dayOfMonth, new Date(y, m, 0).getDate());
          const date = `${cand}-${String(day).padStart(2, "0")}`;
          if (date > todayIso && date <= s.period.end && (r.lastPosted ?? "") < cand) return { r, date };
        }
        return null;
      }).filter((x): x is { r: typeof recurring[number]; date: string } => !!x).sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const bal = balances(settings.accounts, transactions, settings.defaultAccountId);
  const cards = settings.accounts.filter((a) => a.kind === "card" && !a.archived);
  const payFrom = settings.accounts.find((a) => a.kind === "bank" && !a.archived)?.id ?? settings.defaultAccountId;
  const monthTx = inMonth(transactions, month);
  const cardSpent = (id: string) => monthTx.filter((t) => t.type === "expense" && t.accountId === id).reduce((x, t) => x + t.amount, 0);
  // Card bills due in the next 10 days show under "Coming up".
  const cardDues = isNow ? cards.map((c) => ({ c, cs: cardStatus(c, bal.get(c.id) ?? 0) }))
    .filter(({ cs }) => cs.owed > 0 && cs.due && (cs.daysToDue ?? 99) <= 10) : [];
  const alerts = Object.entries(settings.budgets)
    .map(([id, limit]) => ({ id, limit, spent: s.byCategory.find((c) => c.id === id)?.total ?? 0 }))
    .filter((b) => b.limit > 0 && b.spent / b.limit >= 0.8)
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

  const netWorth = [...bal.values()].reduce((a, b) => a + b, 0);
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
          <div className="eyebrow">Spent in {monthLabel(month, "long", false)}{s.period.custom ? ` · ${rangeLabel(s.period)}` : ""}</div>
          <div className="big"><span className="cur">{currencySymbol()}</span>{isPrivate() ? "••••" : Math.round(s.expense).toLocaleString("en-US")}</div>
          <div className="sub"><span className="pace" data-k={k}><i />{chip}</span><span>{line}</span></div>
          {reference > 0 && (
            <div className="meter">
              <div className="meter-track" role="img" aria-label={`${Math.round((s.expense / reference) * 100)}% of ${budget ? "budget" : "income"} used`}>
                <div className="meter-fill" data-k={k === "idle" ? "good" : k} style={{ width: `${pct}%` }} />
                {s.phase === "current" && <div className="meter-mark" style={{ left: `${(s.elapsed / s.days) * 100}%` }} title="Even pace for today" />}
              </div>
              <div className="meter-legend">
                <span>{Math.round((s.expense / reference) * 100)}% of {money(reference)}{carried ? ` (${budget ? "budget" : "income"} ${carried > 0 ? "+" : "−"} ${money(Math.abs(carried))} from ${prevName})` : budget ? " budget" : " income"}</span>
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
          {carried !== 0 && (
            <div className="hero-stat wide"><dt><Repeat2 />{carried > 0 ? `Carried over from ${prevName}` : `Overspent in ${prevName}`}</dt><dd>{money(carried, { sign: true })}</dd>
              <div className="hint">{carried > 0 ? "Added to what you can spend this month." : "Taken off what you can spend this month."}</div></div>
          )}
          {settings.leftover === "save" && lo.saved > 0 && (
            <div className="hero-stat wide"><dt><PiggyBank />Saved from past months</dt><dd>{money(lo.saved)}</dd></div>
          )}
        </dl>
      </section>

      {settings.accounts.filter((a) => !a.archived).length > 1 && (
        <section className="card">
          <div className="card-head"><h2>Accounts</h2><span style={{ display: "flex", gap: 14, alignItems: "baseline" }}><span className="meta">Net worth <b className="num" style={{ color: "var(--ink)" }}>{money(netWorth)}</b></span><Link className="more" to="/accounts">Manage</Link></span></div>
          <div className="acct-strip">
            {settings.accounts.filter((a) => !a.archived).map((a) => {
              const b = bal.get(a.id) ?? 0;
              return (
                <Link key={a.id} to="/accounts" className="acct" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="acct-top"><AccountIcon kind={a.kind} color={a.color} tile /><span style={{ minWidth: 0 }}><b>{a.name}</b></span></span>
                  <span className={`acct-bal ${b < 0 ? "neg" : ""}`}>{money(b)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(
        <div className="grid-2 even">
          <section className="card">
            <div className="card-head">
              <h2>Credit cards</h2>
              {cards.length > 0
                ? <span className="meta">On cards this month: <b className="num" style={{ color: "var(--ink)" }}>{money(cards.reduce((a, c) => a + cardSpent(c.id), 0))}</b></span>
                : <Link className="more" to="/accounts#add-card">Add card</Link>}
            </div>
            {cards.length === 0 ? (
              <div className="empty" style={{ padding: "12px 0" }}>
                <CreditCard /><b>Track your credit card</b>
                <span>See what you've put on the card, what you owe, how much limit is left and when the bill is due.</span>
                <Link className="btn sm" to="/accounts#add-card" style={{ marginTop: 6 }}><Plus />Add credit card</Link>
              </div>
            ) : (
              <div>
                {cards.map((c) => {
                  const cs = cardStatus(c, bal.get(c.id) ?? 0);
                  const spent = cardSpent(c.id);
                  const paid = monthTx.filter((t) => t.type === "transfer" && t.toAccountId === c.id).reduce((x, t) => x + t.amount, 0);
                  const soon = cs.owed > 0 && cs.daysToDue != null && cs.daysToDue <= 5;
                  return (
                    <div className="card-row" key={c.id}>
                      <AccountIcon kind={c.kind} color={c.color} tile />
                      <span className="n"><b>{c.name}</b><small>{money(spent)} spent{paid ? ` · ${money(paid)} paid` : ""} this month</small></span>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="v" style={{ textAlign: "right" }}><b className="num" style={{ fontWeight: 600 }}>{cs.owed ? money(cs.owed) : "Nothing"}</b><small style={{ display: "block", color: "var(--muted)", fontSize: 12.5 }}>{cs.owed ? "to pay" : "owed"}</small></span>
                        {cs.owed > 0 && <button className="btn secondary sm" onClick={() => openSheet({ type: "transfer", preset: { accountId: payFrom, toAccountId: c.id, amount: cs.owed, note: `${c.name} payment` } })}>Pay</button>}
                      </span>
                      {cs.limit != null && <span className="bar"><i style={{ width: `${(cs.used ?? 0) * 100}%`, background: (cs.used ?? 0) > 0.8 ? "var(--neg)" : (cs.used ?? 0) > 0.5 ? "var(--warn)" : c.color }} /></span>}
                      {(cs.limit != null || cs.due) && (
                        <span className="foot">
                          <span>{cs.limit != null ? `${Math.round((cs.used ?? 0) * 100)}% of ${money(cs.limit)} limit · ${money(cs.available ?? 0)} available` : ""}</span>
                          {cs.due && cs.owed > 0 && <span className={soon ? "chip warn" : ""}>{cs.daysToDue === 0 ? "Due today" : `Due ${shortDate(cs.due)} · ${cs.daysToDue} day${cs.daysToDue === 1 ? "" : "s"}`}</span>}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <LeftoverCard rows={lo.rows} mode={settings.leftover} saved={lo.saved} thisLeft={left} isNow={isNow} />
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Spending this month</h2>
            <span className="meta">{prev.expense > 0 && s.phase !== "future" ? compareText(curve[s.elapsed], prevCurve[Math.min(s.elapsed, prevCurve.length - 1)]) : ""}</span>
          </div>
          <TrendChart current={curve} previous={prevCurve} elapsed={s.elapsed} budget={reference || undefined} mk={month} />
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
          {upcoming.length === 0 && alerts.length === 0 && cardDues.length === 0 ? (
            <div className="empty"><CalendarClock /><b>All clear</b>No bills due later this month and every budget has room.</div>
          ) : (
            <div className="stack">
              {cardDues.map(({ c, cs }) => (
                <div className="cat-line" key={`card-${c.id}`}>
                  <AccountIcon kind={c.kind} color={c.color} tile />
                  <span className="n">{c.name} bill<small>Due {dayLabel(cs.due!)} · {cs.daysToDue === 0 ? "today" : `in ${cs.daysToDue} day${cs.daysToDue === 1 ? "" : "s"}`}</small></span>
                  <button className="btn secondary sm" onClick={() => openSheet({ type: "transfer", preset: { accountId: payFrom, toAccountId: c.id, amount: cs.owed, note: `${c.name} payment` } })}>Pay {money(cs.owed)}</button>
                </div>
              ))}
              {upcoming.map(({ r, date }) => {
                const inDays = daysBetween(todayIso, date);
                return (
                  <div className="cat-line" key={r.id}>
                    <CatTile id={r.categoryId} size="sm" />
                    <span className="n">{r.note}<small>Due {dayLabel(date)} · in {inDays} day{inDays === 1 ? "" : "s"}</small></span>
                    <span className={`v ${r.type === "income" ? "amt in" : ""}`}>{r.type === "income" ? "+" : ""}{money(r.amount)}</span>
                  </div>
                );
              })}
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

function LeftoverCard({ rows, mode, saved, thisLeft, isNow }: {
  rows: { mk: string; base: number; carriedIn: number; spent: number; left: number }[];
  mode: "carry" | "save" | "none"; saved: number; thisLeft: number; isNow: boolean;
}) {
  const recent = rows.slice(-4).reverse();
  return (
    <section className="card">
      <div className="card-head">
        <h2>{mode === "save" ? "Savings from leftovers" : "Leftover money"}</h2>
        <Link className="more" to="/settings#leftover">{mode === "none" ? "Turn on" : "Change"}</Link>
      </div>
      {mode === "none" ? (
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>Choose whether money left at the end of a month rolls into the next month or goes to savings.</p>
      ) : (
        <>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink-2)" }}>
            {mode === "carry"
              ? isNow ? `If the month ended today, ${money(Math.max(thisLeft, 0))} would roll into next month.` : "What each month passed on to the next."
              : <>You've kept <b>{money(saved)}</b> across past months.</>}
          </p>
          {recent.length === 0 ? <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>Finished months will appear here.</p> : (
            <div className="stack" style={{ gap: 10 }}>
              {recent.map((r) => {
                const v = mode === "save" ? r.base - r.spent : r.left;
                return (
                  <div key={r.mk} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 14 }}>
                    <span>{monthLabel(r.mk)}<small style={{ display: "block", color: "var(--muted)", fontSize: 12.5 }}>{money(r.spent)} spent of {money(r.base + (mode === "carry" ? r.carriedIn : 0))}</small></span>
                    <span className={`chip ${v >= 0 ? "pos" : "neg"}`}>{v >= 0 ? (mode === "save" ? "Saved " : "Left ") : "Over "}{money(Math.abs(v))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
