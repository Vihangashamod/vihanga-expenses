import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarRange, X } from "lucide-react";
import { getCategory } from "../lib/categories";
import { monthLabel, shiftMonth, shortDate } from "../lib/format";
import { currentPeriodKey, daysBetween, ownPeriod, periodOf, rangeLabel } from "../lib/period";
import { useUI } from "../data/ui";
import { useStore } from "../data/store";

export function CatTile({ id, size }: { id: string; size?: "sm" }) {
  const c = getCategory(id);
  const Icon = c.icon;
  return (
    <span className={`cat-tile ${size ?? ""}`} style={{ background: `${c.color}1F`, color: c.color }} aria-hidden="true">
      <Icon strokeWidth={2} />
    </span>
  );
}

export function MonthSwitch() {
  const { month, setMonth } = useUI();
  const [editing, setEditing] = useState(false);
  const atNow = month >= currentPeriodKey();
  const p = periodOf(month);
  const range = rangeLabel(p, true);
  return (
    <div className="month-wrap">
      <div className="month-switch" role="group" aria-label="Choose month">
        <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft /></button>
        <span aria-live="polite" className="month-label">
          {monthLabel(month)}
          <small>{range}</small>
        </span>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={atNow} aria-label="Next month"><ChevronRight /></button>
        <button className={`dates-btn ${p.custom ? "on" : ""}`} onClick={() => setEditing(true)} aria-label={`Set start and end dates for ${monthLabel(month)}`} title="Set this month's dates">
          <CalendarRange />
        </button>
      </div>
      {editing && <PeriodEditor mk={month} onClose={() => setEditing(false)} />}
    </div>
  );
}

/** Choose the exact start and end dates of a month. */
export function PeriodEditor({ mk, onClose }: { mk: string; onClose: () => void }) {
  const { settings, saveSettings } = useStore();
  const { notify } = useUI();
  const p = periodOf(mk);
  const [start, setStart] = useState(p.start);
  const [end, setEnd] = useState(p.end);
  const [err, setErr] = useState("");
  const name = monthLabel(mk);
  const prevOwn = ownPeriod(shiftMonth(mk, -1));
  const nextOwn = ownPeriod(shiftMonth(mk, 1));
  const days = start && end ? daysBetween(start, end) + 1 : 0;
  const fmt = (iso: string) => shortDate(iso, true);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !end) return setErr("Pick both a start and an end date.");
    if (end < start) return setErr("The end date is before the start date.");
    if (days > 62) return setErr("A month can be at most 62 days long.");
    if (prevOwn && start <= prevOwn.end) return setErr(`${monthLabel(shiftMonth(mk, -1), "long", false)} runs until ${fmt(prevOwn.end)}. Start after that, or change that month first.`);
    if (nextOwn && end >= nextOwn.start) return setErr(`${monthLabel(shiftMonth(mk, 1), "long", false)} starts on ${fmt(nextOwn.start)}. End before that, or change that month first.`);
    await saveSettings({ periods: { ...settings.periods, [mk]: { start, end } } });
    notify(`${name} now runs ${fmt(start)} – ${fmt(end)}`);
    onClose();
  };
  const reset = async () => {
    const next = { ...settings.periods };
    if (ownPeriod(mk)) {
      delete next[mk];
      notify(`Removed the dates for ${name}`);
    } else {
      // Continued from an earlier month: pin it to the calendar month instead.
      const [y, m] = mk.split("-").map(Number);
      next[mk] = { start: `${mk}-01`, end: `${mk}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` };
      notify(`${name} now uses the calendar month`);
    }
    await saveSettings({ periods: next });
    onClose();
  };
  const own = !!ownPeriod(mk);

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="period-title" onSubmit={save} noValidate style={{ maxWidth: 440 }}>
        <div className="grab" />
        <div className="sheet-head">
          <h2 id="period-title">Dates for {name}</h2>
          <button type="button" className="icon-btn plain" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--muted)" }}>
          Everything for {monthLabel(mk, "long", false)} (totals, budgets, charts) counts from the start date to the end date.
          Following months continue from here unless you give them their own dates.
        </p>
        <div className="form-row">
          <div><label className="label" htmlFor="p-start">Starts</label><input id="p-start" className="input" type="date" value={start} onChange={(e) => { setStart(e.target.value); setErr(""); }} /></div>
          <div><label className="label" htmlFor="p-end">Ends</label><input id="p-end" className="input" type="date" value={end} min={start} onChange={(e) => { setEnd(e.target.value); setErr(""); }} /></div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>{days > 0 && end >= start ? `${days} days` : ""}</p>
        {err && <p className="form-error" role="alert">{err}</p>}
        <div className="sheet-actions">
          <button className="btn" type="submit">Save dates</button>
          {(own || p.custom) && <button className="btn secondary" type="button" onClick={reset}>{own ? "Remove these dates" : "Use calendar month"}</button>}
        </div>
      </form>
    </div>
  );
}

export function Avatar() {
  const { user } = useStore();
  const initial = (user?.name ?? "V").trim().charAt(0).toUpperCase();
  return (
    <span className="avatar">
      {user?.photo ? <img src={user.photo} alt="" referrerPolicy="no-referrer" /> : initial}
    </span>
  );
}

export function Logo({ size = 18 }: { size?: number }) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#6FE0AB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-5 4 3 8-8" />
        <path d="M15 7h5v5" />
      </svg>
    </span>
  );
}

export function SyncDot() {
  const { sync, demo } = useStore();
  const text = demo ? "Demo data" : sync === "saving" ? "Saving…" : sync === "offline" ? "Offline – will sync" : sync === "error" ? "Sync problem" : "Synced";
  return <span className="sync" data-s={demo ? "offline" : sync} role="status"><i />{text}</span>;
}
