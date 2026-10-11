import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { LayoutGrid, ArrowLeftRight, Target, PieChart, Settings, Plus, Wallet, Eye, EyeOff } from "lucide-react";
import { useStore } from "../data/store";
import { useUI } from "../data/ui";
import { Avatar, Logo, SyncDot } from "./bits";
import { TransactionSheet } from "./TransactionSheet";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/budgets", label: "Budgets", icon: Target },
  { to: "/insights", label: "Insights", icon: PieChart },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Shell() {
  const { user, error, legacy, importLegacy, dismissLegacy, demo, settings, saveSettings } = useStore();
  const togglePrivacy = () => void saveSettings({ privacy: !settings.privacy });
  const PrivacyBtn = () => (
    <button className="icon-btn plain" onClick={togglePrivacy} aria-pressed={settings.privacy}
      aria-label={settings.privacy ? "Show amounts" : "Hide amounts"} title={settings.privacy ? "Show amounts" : "Hide amounts"}>
      {settings.privacy ? <EyeOff /> : <Eye />}
    </button>
  );
  const { openSheet, toast, dismissToast, notify } = useUI();
  const loc = useLocation();

  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [role=dialog]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") { e.preventDefault(); openSheet(); }
      if (e.key === "i") { e.preventDefault(); openSheet({ type: "income" }); }
      if (e.key === "t") { e.preventDefault(); openSheet({ type: "transfer" }); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [openSheet]);

  const title = NAV.find((n) => (n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to)))?.label ?? "Expenses";

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main">
        <div className="brand"><Logo /><span>Vihanga's Expenses<small>Personal finance · {settings.currency}</small></span></div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon /> {label}
            </NavLink>
          ))}
        </nav>
        <button className="btn block add-btn" onClick={() => openSheet()} title="Shortcut: N"><Plus /> Add transaction</button>
        <div className="sidebar-foot">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><SyncDot /><PrivacyBtn /></div>
          <NavLink to="/settings" className="me">
            <Avatar />
            <div><b>{user?.name}</b><small>{user?.email}</small></div>
          </NavLink>
        </div>
      </aside>

      <header className="topbar">
        <div className="brand"><Logo size={16} /><span>{title}</span></div>
        <PrivacyBtn />
        <NavLink to="/settings" aria-label="Settings"><Avatar /></NavLink>
      </header>

      <main className="main">
        <div className="page" style={{ gap: 12, marginBottom: error || legacy || demo ? 16 : 0 }}>
          {demo && (
            <div className="banner"><span><b>Demo mode.</b> You're looking at sample data. Nothing here is saved.</span></div>
          )}
          {error && <div className="banner err" role="alert"><span>{error}</span></div>}
          {legacy && (
            <div className="banner">
              <span><b>We found {legacy.transactions.length} entries from the old version</b> on {legacy.source}. Bring them into your account?</span>
              <span className="acts">
                <button className="btn sm" onClick={async () => { const n = await importLegacy(); notify(`Imported ${n} entries`); }}>Import</button>
                <button className="btn secondary sm" onClick={() => void dismissLegacy()}>Not now</button>
              </span>
            </div>
          )}
        </div>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.slice(0, 2).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}><Icon />{label}</NavLink>
        ))}
        <div className="tab-fab"><button onClick={() => openSheet()} aria-label="Add transaction"><Plus /></button></div>
        {[NAV[3], NAV[4]].map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}><Icon />{label}</NavLink>
        ))}
      </nav>

      <TransactionSheet />
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && <button onClick={() => { toast.action!.run(); dismissToast(); }}>{toast.action.label}</button>}
        </div>
      )}
    </div>
  );
}
