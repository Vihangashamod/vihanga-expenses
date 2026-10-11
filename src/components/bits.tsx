import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCategory } from "../lib/categories";
import { monthLabel, shiftMonth, thisMonth } from "../lib/format";
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
  const atNow = month >= thisMonth();
  return (
    <div className="month-switch" role="group" aria-label="Choose month">
      <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft /></button>
      <span aria-live="polite">{monthLabel(month)}</span>
      <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={atNow} aria-label="Next month"><ChevronRight /></button>
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
